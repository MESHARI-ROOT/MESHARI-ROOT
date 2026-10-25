import {$} from './ui.js';
const hand='M807,326 C786,320 776,301 762,266 C744,247 730,235 734,214 C737,188 761,188 779,199 L798,218 C806,223 806,211 795,181 C781,153 763,124 770,95 C776,64 797,61 816,71 C843,85 844,123 846,159 L854,209 C865,215 877,162 894,133 C907,109 933,108 946,128 C960,156 936,189 921,222 C915,237 921,245 933,230 C950,207 977,210 985,235 C994,259 973,280 958,300 L933,331 C915,350 891,355 875,341 Z';
export function mascot(id){return `<svg class="mascot" viewBox="0 0 1000 1000" role="img" aria-label="شعار MESHARI الفضائي"><defs><clipPath id="body-${id}"><path d="M0,0H1000V1000H0Z ${hand}" clip-rule="evenodd"/></clipPath><clipPath id="hand-${id}"><path d="${hand}"/></clipPath></defs><image href="/assets/meshari-mascot.png" width="1000" height="1000" clip-path="url(#body-${id})"/><g class="hand-layer"><image href="/assets/meshari-mascot.png" width="1000" height="1000" clip-path="url(#hand-${id})"/></g></svg>`;}
export function startMotion(){
  let reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;try{reduced=localStorage.getItem('zen-reduce')==='1'||reduced;}catch{}
  const intro=$('#intro'),button=$('#motion-button');let timer,priorFocus;
  const setReduced=()=>{document.body.classList.toggle('reduced',reduced);button.setAttribute('aria-pressed',String(reduced));button.textContent=reduced?'الحركة مخفّضة':'تقليل الحركة';};
  function close(){clearTimeout(timer);intro.hidden=true;['#header','#shell','#footer'].forEach(s=>$(s).inert=false);if(priorFocus?.isConnected)priorFocus.focus();}
  function play(){if(reduced)return;priorFocus=document.activeElement;intro.hidden=false;$('#arrival-logo').innerHTML=mascot('arrival');['#header','#shell','#footer'].forEach(s=>$(s).inert=true);$('#skip-intro').focus();intro.querySelectorAll('.ship,.beam,.portal,.alien-arrival').forEach(el=>{el.getAnimations().forEach(a=>{a.cancel();a.play();});});timer=setTimeout(close,5100);}
  setReduced();button.onclick=()=>{reduced=!reduced;try{localStorage.setItem('zen-reduce',reduced?'1':'0');}catch{}setReduced();if(reduced)close();};
  $('#skip-intro').onclick=close;$('#replay-intro').onclick=()=>{if(reduced){reduced=false;setReduced();}play();};
  document.addEventListener('keydown',e=>{if(!intro.hidden){if(e.key==='Escape')close();if(e.key==='Tab'){e.preventDefault();$('#skip-intro').focus();}}});
  const canvas=$('#stars'),ctx=canvas.getContext('2d');if(ctx){let w,h,last=0,seed=1704;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};const stars=Array.from({length:100},(_,i)=>({x:rng(),y:rng(),r:.4+rng()*1.1,p:rng()*7,g:i%5===0}));
    const resize=()=>{const d=Math.min(devicePixelRatio||1,2);w=innerWidth;h=innerHeight;canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0);};addEventListener('resize',resize);resize();
    function draw(now){requestAnimationFrame(draw);if(document.hidden||now-last<(reduced?1000:40))return;last=now;const t=reduced?0:now/1000;ctx.clearRect(0,0,w,h);for(const s of stars){ctx.fillStyle=s.g?'#d8b442':'#e9eef2';ctx.globalAlpha=.17+.48*(.5+.5*Math.sin(t*.65+s.p));ctx.beginPath();ctx.arc(s.x*w,((s.y+t*.0005)%1)*h,s.r,0,Math.PI*2);ctx.fill();}}requestAnimationFrame(draw);
  }
  let seen=false;try{seen=sessionStorage.getItem('zen-intro')==='1';sessionStorage.setItem('zen-intro','1');}catch{}if(!seen)play();
}
