/* Scalar Newton equations: honest forward Euler and time-parametrized Kepler orbits. */
(function(){
'use strict';
const TAU=2*Math.PI;
function keplerState(t,e=.4,a=1,mu=1){
 const rate=Math.sqrt(mu/(a*a*a)),mean=rate*t,b=a*Math.sqrt(1-e*e);
 let E=mean;
 for(let i=0;i<24;i++){const d=(E-e*Math.sin(E)-mean)/(1-e*Math.cos(E));E-=d;if(Math.abs(d)<1e-14)break;}
 const dE=rate/(1-e*Math.cos(E));
 return {t,E,x:a*(Math.cos(E)-e),y:b*Math.sin(E),vx:-a*Math.sin(E)*dE,vy:b*Math.cos(E)*dE,r:a*(1-e*Math.cos(E)),H:Math.sqrt(mu*a*(1-e*e)),period:TAU/rate};
}
function eulerOrbit(steps,e=.4,a=1,mu=1){
 const first=keplerState(0,e,a,mu),dt=first.period/steps,points=[first];
 for(let i=1;i<=steps;i++){
  const q=points[i-1],r=Math.hypot(q.x,q.y),factor=mu/(r*r*r);
  points.push({t:i*dt,x:q.x+dt*q.vx,y:q.y+dt*q.vy,vx:q.vx-dt*factor*q.x,vy:q.vy-dt*factor*q.y});
 }
 return {points,dt,steps,period:first.period};
}
function orbitInvariants(q,mu=1){
 const r=Math.hypot(q.x,q.y),H=q.x*q.vy-q.y*q.vx,alpha=H*q.vy/mu-q.x/r,beta=-H*q.vx/mu-q.y/r;
 return {H,energy:(q.vx*q.vx+q.vy*q.vy)/2-mu/r,alpha,beta,e:Math.hypot(alpha,beta),p:H*H/mu};
}
const models={keplerState,eulerOrbit,orbitInvariants};
if(typeof module!=='undefined'&&module.exports)module.exports=models;
if(typeof document==='undefined')return;
const NS='http://www.w3.org/2000/svg',instances=new Set();let serial=0;
function setup(host){
 const kind=host.dataset.orbitMotion;if(!['numerical','analytic'].includes(kind)||host.dataset.orbitReady)return;
 host.dataset.orbitReady='1';host.classList.add('teaching-motion','orbit-motion');
 const numeric=kind==='numerical',id='orbit-motion-'+(++serial),title=numeric?'逐步算出行星轨道':'椭圆轨道与等面积',initial=numeric?.35:.12;
 let e=.4,steps=1920,u=initial,model=null,playing=false,frame=0,last=0;
 host.innerHTML='<figcaption>'+title+'</figcaption><div class="motion-controls">'+(numeric?'<label for="'+id+'-steps">步长 h</label><select id="'+id+'-steps"><option value="240">0.02618</option><option value="1920" selected>0.00327</option><option value="15360">0.00041</option></select><button type="button" class="orbit-step">走一步</button>':'<label for="'+id+'-e">离心率 e</label><input id="'+id+'-e" class="orbit-e" type="range" min="0" max="70" step="5" value="40"><output class="orbit-e-value">0.40</output>')+'</div><div class="motion-controls"><label for="'+id+'-time">时间 t</label><input id="'+id+'-time" class="orbit-time" type="range" min="0" max="1000" step="1"><output class="orbit-time-value"></output><button type="button" class="orbit-play" aria-pressed="false">播放</button><button type="button" class="orbit-reset">重置</button></div><svg viewBox="0 0 640 500" role="img" aria-label="'+title+'"></svg><p class="orbit-legend">'+(numeric?'<span class="orbit-gold">实线：欧拉轨道</span>　虚线：解析轨道':'<span class="orbit-teal">青色</span>与<span class="orbit-gold">金色</span>区域：等时扫过的等面积')+'</p><p class="motion-values" aria-live="off"></p>';
 const svg=host.querySelector('svg'),status=host.querySelector('.motion-values'),play=host.querySelector('.orbit-play'),time=host.querySelector('.orbit-time'),timeValue=host.querySelector('.orbit-time-value'),select=host.querySelector('select'),step=host.querySelector('.orbit-step'),ecc=host.querySelector('.orbit-e');
 function add(tag,attrs,text){const el=document.createElementNS(NS,tag);for(const [key,value]of Object.entries(attrs||{}))el.setAttribute(key,String(value));if(text!==undefined)el.textContent=text;svg.appendChild(el);return el;}
 function line(a,b,cls='orbit-axis'){add('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],class:cls});}
 function text(x,y,s,cls='orbit-label'){add('text',{x,y,class:cls},s);}
 function path(points,cls,close=false){add('path',{d:points.map((p,i)=>(i?'L':'M')+p.map(v=>v.toFixed(3)).join(',')).join('')+(close?'Z':''),class:cls});}
 function arrow(a,b,cls='orbit-axis'){line(a,b,cls);const q=Math.atan2(b[1]-a[1],b[0]-a[0]);line(b,[b[0]-8*Math.cos(q-.45),b[1]-8*Math.sin(q-.45)],cls);line(b,[b[0]-8*Math.cos(q+.45),b[1]-8*Math.sin(q+.45)],cls);}
 function thin(points){const stride=Math.max(1,Math.ceil(points.length/900));return points.filter((_,i)=>i%stride===0||i===points.length-1);}
 function draw(){
  if(numeric&&(!model||model.steps!==steps))model=eulerOrbit(steps);
  const exact=Array.from({length:241},(_,i)=>keplerState(TAU*i/240,e)),all=numeric?exact.concat(model.points):exact;
  let xmin=Math.min(...all.map(q=>q.x)),xmax=Math.max(...all.map(q=>q.x)),ymin=Math.min(...all.map(q=>q.y)),ymax=Math.max(...all.map(q=>q.y));
  const scale=Math.min(500/(xmax-xmin+.3),355/(ymax-ymin+.18)),cx=(xmin+xmax)/2,cy=(ymin+ymax)/2,X=x=>320+(x-cx)*scale,Y=y=>248-(y-cy)*scale;
  svg.replaceChildren();arrow([40,Y(0)],[590,Y(0)]);arrow([X(0),433],[X(0),50]);text(607,Y(0)+7,'x');text(X(0)-18,35,'y');
  if(!numeric){
   for(const [start,cls]of [[0,'orbit-area-a'],[TAU/2,'orbit-area-b']]){
    const points=[[X(0),Y(0)]];for(let i=0;i<=80;i++){const q=keplerState(start+TAU*.075*i/80,e);points.push([X(q.x),Y(q.y)]);}path(points,cls,true);
   }
  }
  path(exact.map(q=>[X(q.x),Y(q.y)]),numeric?'orbit-reference':'orbit-ellipse');
  let q,t,index=0;
  if(numeric){
   index=Math.min(steps,Math.floor(u*steps+1e-8));q=model.points[index];t=q.t;
   path(thin(model.points.slice(0,index+1)).map(p=>[X(p.x),Y(p.y)]),'orbit-euler');
   const reference=keplerState(t),error=Math.hypot(q.x-reference.x,q.y-reference.y);
   status.textContent='h = '+model.dt.toFixed(5)+'　步数 '+index+'　位置误差 '+error.toFixed(4);
   step.disabled=index>=steps;select.value=String(steps);
   Object.assign(host.dataset,{steps:String(steps),step:String(model.dt),index:String(index),error:String(error)});
  }else{
   t=TAU*u;q=keplerState(t,e);line([X(0),Y(0)],[X(q.x),Y(q.y)],'orbit-radius');
   const length=Math.hypot(q.vx,q.vy);arrow([X(q.x),Y(q.y)],[X(q.x)+46*q.vx/length,Y(q.y)-46*q.vy/length],'orbit-velocity');
   ecc.value=String(Math.round(e*100));host.querySelector('.orbit-e-value').textContent=e.toFixed(2);
   const area=q.H*TAU*.075/2;
   status.textContent='相同时间 Δt = '+(TAU*.075).toFixed(3)+'　两块面积均为 '+area.toFixed(3);
   Object.assign(host.dataset,{eccentricity:String(e),sweptArea:String(area),speed:String(length)});
  }
  add('circle',{cx:X(0),cy:Y(0),r:10,class:'orbit-sun'});text(X(0)+30,Y(0)+32,'太阳');
  add('circle',{cx:X(q.x),cy:Y(q.y),r:6,class:'orbit-planet'});
  if(numeric){const first=model.points[0];add('circle',{cx:X(first.x),cy:Y(first.y),r:4,class:'orbit-start'});}
  text(320,475,numeric?'μ = 1，初始位置 (0.6, 0)':'a = 1，太阳在焦点');
  time.value=String(Math.round(u*1000));timeValue.textContent=t.toFixed(2);time.setAttribute('aria-valuetext',t.toFixed(3));
  Object.assign(host.dataset,{progress:String(u),time:String(t),pointX:String(q.x),pointY:String(q.y),finite:String(Number.isFinite(q.x)&&Number.isFinite(q.y))});
 }
 function stop(){playing=false;cancelAnimationFrame(frame);play.textContent='播放';play.setAttribute('aria-pressed','false');host.dataset.playing='false';}
 function tick(now){if(!playing)return;if(!host.isConnected||document.hidden||host.closest('[hidden]')){stop();return;}if(last){u=Math.min(1,u+Math.min(now-last,60)/12000);draw();}last=now;if(u>=1){stop();return;}frame=requestAnimationFrame(tick);}
 play.addEventListener('click',()=>{if(playing){stop();return;}if(u>=1)u=0;playing=true;last=0;play.textContent='暂停';play.setAttribute('aria-pressed','true');host.dataset.playing='true';frame=requestAnimationFrame(tick);});
 host.querySelector('.orbit-reset').addEventListener('click',()=>{stop();e=.4;steps=1920;u=0;draw();});
 time.addEventListener('input',()=>{stop();u=Number(time.value)/1000;draw();});
 if(select)select.addEventListener('change',()=>{stop();steps=Number(select.value);draw();});
 if(step)step.addEventListener('click',()=>{stop();u=Math.min(1,(Math.floor(u*steps+1e-8)+1)/steps);draw();});
 if(ecc)ecc.addEventListener('input',()=>{stop();e=Number(ecc.value)/100;draw();});
 instances.add({host,stop});draw();
}
function init(){for(const item of instances)if(!item.host.isConnected){item.stop();instances.delete(item);}document.querySelectorAll('[data-orbit-motion]').forEach(setup);}
document.addEventListener('reader:chapter',init);document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const item of instances)item.stop();});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
