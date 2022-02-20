fetch('https://api.github.com/repos/R2Northstar/Northstar/releases/latest')
    .then(response => response.json())
    .then(data => {
        document.querySelectorAll('.download').forEach(d => { d.href = data.assets[0].browser_download_url });
        console.log("Successfully fetched latest release download URL. Updating download links.")
    }).catch(() => {
    console.log("Failed to fetch latest release download URL, ratelimit was likely reached. Download links will fallback to the GitHub latest release page.")
    })

document.addEventListener('scroll', () => {
    if(window.scrollY > 0) {
        document.querySelector('#top').style.backgroundColor = 'rgba(0,0,0,0.25)';
    } else {
        document.querySelector('#top').style.backgroundColor = 'rgba(0,0,0,0)';
    }
})