import {$} from './ui.js';
// Keep the original logo intact and static; arrival motion applies to its container.
export function mascot(){return `<svg class="mascot" viewBox="0 0 1000 1000" role="img" aria-label="شعار MESHARI الفضائي"><image href="/assets/meshari-mascot.png" width="1000" height="1000"/></svg>`;}
export function startMotion(){
  let reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;try{reduced=localStorage.getItem('zen-reduce')==='1'||reduced;}catch{}
  const intro=$('#intro'),button=$('#motion-button');let timer,priorFocus;
  const setReduced=()=>{document.body.classList.toggle('reduced',reduced);button.setAttribute('aria-pressed',String(reduced));button.textContent=reduced?'الحركة مخفّضة':'تقليل الحركة';};
  function close(){clearTimeout(timer);intro.hidden=true;document.body.classList.remove('intro-open');['#header','#shell','#footer'].forEach(s=>$(s).inert=false);if(priorFocus?.isConnected)priorFocus.focus();}
  function play(){clearTimeout(timer);if(reduced)return;priorFocus=document.activeElement;intro.hidden=false;document.body.classList.add('intro-open');$('#arrival-logo').innerHTML=mascot('arrival');['#header','#shell','#footer'].forEach(s=>$(s).inert=true);$('#skip-intro').focus();intro.querySelectorAll('.ship,.beam,.portal,.alien-arrival,.intro-text,.intro-progress span').forEach(el=>{el.getAnimations().forEach(a=>{a.cancel();a.play();});});timer=setTimeout(close,7200);}
  setReduced();button.onclick=()=>{reduced=!reduced;try{localStorage.setItem('zen-reduce',reduced?'1':'0');}catch{}setReduced();if(reduced)close();};
  $('#skip-intro').onclick=close;$('#replay-intro').onclick=()=>{if(reduced){reduced=false;setReduced();}play();};
  document.addEventListener('keydown',e=>{if(!intro.hidden){if(e.key==='Escape')close();if(e.key==='Tab'){e.preventDefault();$('#skip-intro').focus();}}});
  const canvas=$('#stars'),ctx=canvas.getContext('2d');if(ctx){
    let w,h,last=0,seed=1704;
    const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const stars=Array.from({length:150},(_,i)=>({x:rng(),y:rng(),r:.45+rng()*1.35,p:rng()*7,g:i%6===0,speed:.001+rng()*.002}));
    const resize=()=>{const d=Math.min(devicePixelRatio||1,2);w=innerWidth;h=innerHeight;canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0);};
    addEventListener('resize',resize,{passive:true});resize();
    function satellite(x,y,scale,angle,t){
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);ctx.globalAlpha=.64;
      // Solar arrays, connecting boom, thermal body and communications dish.
      ctx.strokeStyle='#9da9b8';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-41,0);ctx.lineTo(41,0);ctx.stroke();
      for(const side of [-1,1]){const px=side===-1?-43:15;ctx.fillStyle='#233b56';ctx.fillRect(px,-13,28,26);ctx.strokeStyle='#6889ad';ctx.strokeRect(px,-13,28,26);ctx.strokeStyle='#7595ad70';
        for(let j=1;j<4;j++){ctx.beginPath();ctx.moveTo(px+j*7,-13);ctx.lineTo(px+j*7,13);ctx.stroke();}ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px+28,0);ctx.stroke();}
      ctx.fillStyle='#b4b4a2';ctx.strokeStyle='#f0d592';ctx.fillRect(-9,-12,18,24);ctx.strokeRect(-9,-12,18,24);ctx.fillStyle='#e0c478';ctx.fillRect(-5,-7,10,6);
      ctx.strokeStyle='#a5b0b8';ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(0,-22);ctx.moveTo(-9,-23);ctx.quadraticCurveTo(0,-11,9,-23);ctx.stroke();
      ctx.fillStyle='#e8cb85';ctx.globalAlpha=.45+.3*Math.sin(t*1.4);ctx.beginPath();ctx.arc(0,-25,1.8,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    function draw(now){
      requestAnimationFrame(draw);if(document.hidden||now-last<(reduced?1000:40))return;last=now;
      const t=reduced?0:now/1000;
      ctx.clearRect(0,0,w,h);
      const count=w<600?85:150;
      for(const s of stars.slice(0,count)){const x=((s.x+t*s.speed*.3)%1)*w,y=((s.y+t*s.speed)%1)*h;
        ctx.fillStyle=s.g?'#ecd18b':'#d7e5f2';ctx.globalAlpha=.25+.55*(.5+.5*Math.sin(t*.7+s.p));ctx.beginPath();ctx.arc(x,y,s.r,0,Math.PI*2);ctx.fill();
        if(s.r>1.5){ctx.globalAlpha*=.22;ctx.fillRect(x-4,y-.4,8,.8);ctx.fillRect(x-.4,y-4,.8,8);}}
      ctx.globalAlpha=1;
      satellite((.09+(t/100)%1.2)*w-w*.1,h*(.17+.035*Math.sin(t*.15)),w<600?.48:.7,-.4+t*.006,t);
      satellite(w*(.9-.04*Math.sin(t*.06)),((.34+t/140)%1.25)*h-h*.05,w<600?.4:.58,.55-t*.008,t+2);
      if(w>760)satellite(w*(.14+.035*Math.sin(t*.09)),((.82-t/180)%1.3+1.3)%1.3*h,.42,-.65+t*.01,t+4);
    }
    requestAnimationFrame(draw);
  }
  // Play on each page opening; in-page navigation never restarts it.
  play();
}
