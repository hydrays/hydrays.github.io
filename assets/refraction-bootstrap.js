/* Content-local loader also works when entering this lesson through the reader. */
(function () {
  'use strict';
  const source=document.currentScript;
  if(!source)return;
  const base=new URL('.',source.src),version='20261108-general-descent';
  const css=new URL('refraction-gradient.css?v='+version,base).href;
  if(!Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(link=>link.href===css)) {
    const link=document.createElement('link');link.rel='stylesheet';link.href=css;document.head.appendChild(link);
  }
  if(window.refractionGradientAnimationsLoaded) {
    document.dispatchEvent(new Event('reader:chapter'));return;
  }
  if(window.refractionGradientAssetsLoading)return;
  function load(name) {
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=new URL(name+'?v='+version,base).href;
      script.onload=resolve;script.onerror=()=>reject(new Error('Could not load '+name));
      document.head.appendChild(script);
    });
  }
  window.refractionGradientAssetsLoading=(window.RefractionGradientModel?Promise.resolve():load('refraction-model.js'))
    .then(()=>load('refraction-gradient.js'))
    .catch(error=>{
      window.refractionGradientAssetsLoading=null;
      document.querySelectorAll('.refraction-gradient:not([data-ready]),.refraction-stability:not([data-ready])')
        .forEach(host=>{host.textContent='动画暂未加载，请刷新页面重试。';});
      console.error(error);
    });
})();
