
let sessionCookie;
let AuthToken;
let authed = false;

const puppeteer = require('puppeteer');
const { parseString } = require('xml2js');

async function authWithOrigin() {
    // epoch stuff is a jank solution to the required execution that the signin page requires
    let executionBaseEpoch = "1644756789";
    let executionBase = "467202215";
    let execution = executionBase - Math.floor(executionBaseEpoch) + Math.floor(Date.now() / 1000); // calculate execution number (i have no idea how it works but i guessed this and it works)
    let loginPath = `https://signin.ea.com/p/originX/login?execution=e${execution}s1&initref=https%3A%2F%2Faccounts.ea.com%3A443%2Fconnect%2Fauth%3Fdisplay%3DoriginXWeb%252Flogin%26response_type%3Dcode%26release_type%3Dprod%26redirect_uri%3Dhttps%253A%252F%252Fwww.origin.com%252Fviews%252Flogin.html%26locale%3Den_US%26client_id%3DORIGIN_SPA_ID`

    console.log("Launching sign in headless browser")
    const browser = await puppeteer.launch({
        headless: true
    });
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (req) => { // block non-required files from being requested by puppeteer, might speed things up a little bit
        if(["stylesheet", "image", "media", "font"].indexOf(req.resourceType()) > -1){
            req.abort();
        }
        else {
            req.continue();
        }
    });

    if(sessionCookie) page.setCookie(sessionCookie)

    await page.goto(loginPath);

    if(await page.url().startsWith("https://www.origin.com/views/login.html?code=")) { // don't try to login again if it's already logged in cause it will crash
        console.log("Already logged into Origin")
    } else {
        console.log("Attempting Origin login")
        let email = process.env.ORIGIN_EMAIL;
        let password = process.env.ORIGIN_PASSWORD;
        await page.evaluate((email, password) => {
            document.querySelector('#email').value = email;
            document.querySelector('#password').value = password;
        }, email, password);
        await Promise.all([
            page.click('#logInBtn'),
            page.waitForNavigation({waitUntil: 'networkidle2'})
        ]);
    }

    console.log("Getting Origin auth token")
    page.goto('https://accounts.ea.com/connect/auth?client_id=ORIGIN_JS_SDK&response_type=token&redirect_uri=nucleus:rest&prompt=none&release_type=prod');
    await page.waitForNavigation({waitUntil: 'domcontentloaded'})
    response = JSON.parse(await page.evaluate(() =>  {
        return document.querySelector("body").innerText;
    }));
    AuthToken = response.access_token;
    authed = true;
    console.log("Successfully got Origin token");
    sessionCookie = (await page.cookies()).find(c => c.name == 'sid');
    await browser.close();

    setTimeout(authWithOrigin, Number(response.expires_in)*1000 - 60000); // Refresh access token 1 minute before it expires just to be safe
}

authWithOrigin();

const asyncHttp = require("./asynchttp.js")

function getUserInfo(uid) {
    return new Promise(async (resolve, reject) => {
        try {
            if(!authed || !AuthToken) resolve(undefined);

            let response = await asyncHttp.request( {
				method: "GET",
				host: "https://api1.origin.com",
				port: 443,
				path: `/atom/users?userIds=${uid}`,
                headers: { 'AuthToken': AuthToken }
			} )

			let json
			try {
                json = await new Promise(resolve => {
                    parseString(response.toString(), function (err, result) {
                        resolve(result);
                    });
                });
			} catch (error) {
				reject(error);
			}
            resolve(json.users.user[0])
        } catch (error) {
            reject(error)
        }
    })
}

module.exports = {
    getUserInfo
}