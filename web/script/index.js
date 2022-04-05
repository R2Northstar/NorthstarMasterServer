fetch('https://api.github.com/repos/R2Northstar/Northstar/releases/latest')
    .then(response => response.json())
    .then(data => {
        document.querySelectorAll('.download').forEach(d => { d.href = data.assets[0].browser_download_url });
        console.log("Successfully fetched latest release download URL. Updating download links.");
        var fileSize = data.assets[0].size;
        var sizeInMb = fileSize/1024/1024;
        document.querySelectorAll('.big-button.download > span').forEach(e => { e.innerText = 'DOWNLOAD ('+sizeInMb.toFixed(1)+' MB)'});
    }).catch(() => {
    console.warn("Failed to fetch latest release download URL, ratelimit was likely reached. Download links will fallback to the GitHub latest release page.")
    })

document.addEventListener('scroll', () => {
    if(window.scrollY > 0) {
        document.querySelector('#top').style.backgroundColor = 'rgba(0,0,0,0.25)';
    } else {
        document.querySelector('#top').style.backgroundColor = 'rgba(0,0,0,0)';
    }
})

// Deobfuscate this if you dare, or just check the console
function _0xe6ea(){var _0x640589=['1555oGBNTZ','9CgkcxT','Interested\x20in\x20modding?\x20Join\x20the\x20Discord\x20(','12376pyAMuM','https://r2northstar.readthedocs.io/','href','9fQLFHO','10100490NZNwkU','4461162TlMdSc','discord)\x20and\x20have\x20a\x20look\x20at\x20the\x20modding\x20docs\x20(','log','7223992BtxUJz','2064209JWVbyU','286914NYeCpq','8653536OttIGJ'];_0xe6ea=function(){return _0x640589;};return _0xe6ea();}var _0x3f0821=_0x56b1;function _0x56b1(_0x2b5818,_0x5491bc){var _0xe6ea0d=_0xe6ea();return _0x56b1=function(_0x56b1ff,_0x153296){_0x56b1ff=_0x56b1ff-0x14f;var _0xa5bd01=_0xe6ea0d[_0x56b1ff];return _0xa5bd01;},_0x56b1(_0x2b5818,_0x5491bc);}(function(_0x195461,_0x4a80ec){var _0x3ee3f4=_0x56b1,_0x5badab=_0x195461();while(!![]){try{var _0xfe9d3f=parseInt(_0x3ee3f4(0x158))/0x1*(parseInt(_0x3ee3f4(0x155))/0x2)+-parseInt(_0x3ee3f4(0x150))/0x3+-parseInt(_0x3ee3f4(0x15a))/0x4*(-parseInt(_0x3ee3f4(0x157))/0x5)+-parseInt(_0x3ee3f4(0x156))/0x6+-parseInt(_0x3ee3f4(0x154))/0x7+-parseInt(_0x3ee3f4(0x153))/0x8*(-parseInt(_0x3ee3f4(0x15d))/0x9)+parseInt(_0x3ee3f4(0x14f))/0xa;if(_0xfe9d3f===_0x4a80ec)break;else _0x5badab['push'](_0x5badab['shift']());}catch(_0x270bc5){_0x5badab['push'](_0x5badab['shift']());}}}(_0xe6ea,0xe6076),console[_0x3f0821(0x152)](_0x3f0821(0x159)+location[_0x3f0821(0x15c)]+_0x3f0821(0x151)+_0x3f0821(0x15b)+')'));
