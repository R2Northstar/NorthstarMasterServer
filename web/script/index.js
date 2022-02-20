fetch('https://api.github.com/repos/R2Northstar/Northstar/releases/latest')
  .then(response => response.json())
  .then(data => {
      document.querySelectorAll('.download').forEach(d => { d.href = data.assets[0].browser_download_url });
  });

document.addEventListener('scroll', () => {
    if(window.scrollY > 0) {
        document.querySelector('#top').style.backgroundColor = 'rgba(0,0,0,0.25)';
    } else {
        document.querySelector('#top').style.backgroundColor = 'rgba(0,0,0,0)';
    }
})