/* ODE lessons: exact models, refraction layers and local SVG interactions. */
(function(){
'use strict';
const TAU=2*Math.PI;
function cycloid(theta,R=1){return {x:R*(theta-Math.sin(theta)),y:R*(1-Math.cos(theta)),dx:R*(1-Math.cos(theta)),dy:R*Math.sin(theta)};}
function layeredRay(n,L=Math.PI,H=2,g=9.8){
 const dy=H/n,speeds=Array.from({length:n},(_,i)=>Math.sqrt(2*g*(i+.5)*dy));
 const span=p=>speeds.reduce((sum,v)=>sum+dy*p*v/Math.sqrt(1-(p*v)**2),0);
 let lo=0,hi=(1-1e-12)/speeds[n-1];for(let j=0;j<80;j++){const mid=(lo+hi)/2;if(span(mid)>L)hi=mid;else lo=mid;}
 const p=(lo+hi)/2,points=[{x:0,y:0}],angles=[];let x=0;
 for(let i=0;i<n;i++){const sine=p*speeds[i];angles.push(Math.asin(sine));x+=dy*sine/Math.sqrt(1-sine*sine);points.push({x,y:(i+1)*dy});}
 return {points,speeds,angles,p,n,L,H};
}
function createRace(g=9.8){
 const L=Math.PI,H=2,length=Math.hypot(L,H),lineTime=Math.sqrt(2*length*length/(g*H));
 const radius=(L*L+H*H)/(2*L),phiB=2*Math.atan(L/H),end=Math.sqrt(phiB),count=1200,du=end/count,scale=Math.sqrt(radius/(2*g));
 const integrand=u=>u===0?2:2*u/Math.sqrt(Math.sin(u*u));
 const table=[{u:0,time:0}];let time=0;
 for(let i=1;i<=count;i++){const a=(i-1)*du,b=i*du;time+=scale*du*(integrand(a)+4*integrand((a+b)/2)+integrand(b))/6;table.push({u:b,time});}
 const circleTime=time,cycloidTime=Math.PI/Math.sqrt(g);
 function circleAt(t){
  if(t<=0)return {x:0,y:0};if(t>=circleTime)return{x:L,y:H};
  let a=0,b=count;while(b-a>1){const m=(a+b)>>1;if(table[m].time<t)a=m;else b=m;}
  const weight=(t-table[a].time)/(table[b].time-table[a].time),u=table[a].u+weight*(table[b].u-table[a].u),phi=u*u;
  return {x:radius*(1-Math.cos(phi)),y:radius*Math.sin(phi)};
 }
 function lineAt(t){const u=Math.min(1,Math.max(0,t/lineTime))**2;return{x:L*u,y:H*u};}
 function cycloidAt(t){return cycloid(Math.min(Math.PI,Math.max(0,t)*Math.sqrt(g)));}
 return {g,L,H,lineTime,circleTime,cycloidTime,maxTime:Math.max(lineTime,circleTime,cycloidTime),radius,phiB,lineAt,circleAt,cycloidAt};
}
function eulerDecay(h,end=3){const count=Math.round(end/h),points=[{x:0,y:1}];for(let i=1;i<=count;i++)points.push({x:i*h,y:points[i-1].y*(1-h)});return points;}
const models={cycloid,layeredRay,createRace,eulerDecay};
if(typeof module!=='undefined'&&module.exports)module.exports=models;
if(typeof document==='undefined')return;
const NS='http://www.w3.org/2000/svg',instances=new Set();let serial=0,raceCache;
const specs={
 field:{title:'变化方向与初始条件',initial:.6},growth:{title:'比例系数怎样改变增长过程',initial:.6},
 race:{title:'哪条路线先到终点？',initial:0},layers:{title:'从分层折射到连续曲线',initial:4/44},
 cycloid:{title:'滚动的圆与摆线',initial:.25},euler:{title:'沿当前斜率走一小步',initial:0}
};
function setup(host){
 const kind=host.dataset.odeMotion,spec=specs[kind];if(!spec||host.dataset.odeReady)return;host.dataset.odeReady='1';host.classList.add('teaching-motion','ode-motion');
 const id='ode-motion-'+(++serial),race=kind==='race'?(raceCache||(raceCache=createRace())):null;
 let u=spec.initial,y0=1.5,k=.2,n=8,h=.5,playing=false,frame=0,last=0;
 let control='';
 if(kind==='field')control='<label for="'+id+'-param">初值 y(0)</label><input id="'+id+'-param" class="ode-param" type="range" min="-20" max="20" step="1" value="15"><output class="ode-param-value"></output>';
 else if(kind==='growth')control='<label for="'+id+'-param">比例系数 k</label><input id="'+id+'-param" class="ode-param" type="range" min="-60" max="60" step="5" value="20"><output class="ode-param-value"></output>';
 else if(kind==='layers')control='<label for="'+id+'-param">层数 n</label><input id="'+id+'-param" class="ode-param" type="range" min="4" max="48" step="4" value="8"><output class="ode-param-value"></output>';
 else if(kind==='euler')control='<label for="'+id+'-step">步长 h</label><select id="'+id+'-step"><option value="0.5">0.5</option><option value="0.25">0.25</option><option value="0.1">0.1</option></select><button type="button" class="ode-step">走一步</button>';
 else control='<label for="'+id+'-progress">'+(kind==='race'?'时间 t':'参数 θ')+'</label><input id="'+id+'-progress" class="ode-progress" type="range" min="0" max="1000" step="1"><output class="ode-progress-value"></output>';
 host.innerHTML='<figcaption>'+spec.title+'</figcaption><div class="motion-controls">'+control+'<button type="button" class="ode-play" aria-pressed="false">'+(kind==='layers'?'细分':'播放')+'</button><button type="button" class="ode-reset">重置</button></div><svg viewBox="0 0 760 '+(kind==='cycloid'?350:440)+'" role="img" aria-label="'+spec.title+'"></svg>'+(kind==='race'?'<div class="ode-race-times"><span class="ode-route-line">直线 <output></output></span><span class="ode-route-circle">圆弧 <output></output></span><span class="ode-route-cycloid">曲线 C <output></output></span></div>':'')+'<p class="motion-values" aria-live="off"></p>';
 const svg=host.querySelector('svg'),status=host.querySelector('.motion-values'),play=host.querySelector('.ode-play'),reset=host.querySelector('.ode-reset'),parameter=host.querySelector('.ode-param'),parameterValue=host.querySelector('.ode-param-value'),progress=host.querySelector('.ode-progress'),progressValue=host.querySelector('.ode-progress-value'),select=host.querySelector('select'),stepButton=host.querySelector('.ode-step');
 function add(tag,attrs,text){const el=document.createElementNS(NS,tag);for(const [key,value]of Object.entries(attrs||{}))el.setAttribute(key,String(value));if(text!==undefined)el.textContent=text;svg.appendChild(el);return el;}
 function text(x,y,value,cls='ode-label'){return add('text',{x,y,class:cls},value);}
 function line(a,b,cls='ode-guide'){return add('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],class:cls});}
 function path(points,cls){return add('path',{d:points.map((p,i)=>(i?'L':'M')+p.map(x=>x.toFixed(3)).join(',')).join(''),class:cls});}
 function sample(fn,a,b,count=150){return Array.from({length:count+1},(_,i)=>fn(a+(b-a)*i/count));}
 function arrow(a,b,cls='ode-axis'){line(a,b,cls);const angle=Math.atan2(b[1]-a[1],b[0]-a[0]);line(b,[b[0]-8*Math.cos(angle-.45),b[1]-8*Math.sin(angle-.45)],cls);line(b,[b[0]-8*Math.cos(angle+.45),b[1]-8*Math.sin(angle+.45)],cls);}
 function point(x,y,cls='ode-current'){return add('circle',{cx:x,cy:y,r:5,class:cls});}
 function axes(xmin,xmax,ymin,ymax,independent='t',dependent='y'){
  const X=x=>70+(x-xmin)/(xmax-xmin)*620,Y=y=>360-(y-ymin)/(ymax-ymin)*300;
  arrow([60,Y(0)],[710,Y(0)]);arrow([X(0),373],[X(0),40]);text(724,Y(0)+7,independent);text(X(0)-18,30,dependent);
  for(let i=0;i<=3;i++){const x=xmin+(xmax-xmin)*i/3;line([X(x),Y(0)-4],[X(x),Y(0)+4],'ode-axis');text(X(x),Y(0)+30,Number(x.toFixed(2)));}
  for(let i=0;i<=4;i++){const y=ymin+(ymax-ymin)*i/4;if(Math.abs(y)<1e-10)continue;text(X(0)-28,Y(y)+6,Number(y.toPrecision(3)));}
  return {X,Y};
 }
 function geometricAxes(){const X=x=>90+145*x,Y=y=>70+145*y;arrow([70,70],[700,70]);arrow([90,50],[90,410]);text(717,76,'x');text(72,425,'y');text(72,51,'A');text(X(Math.PI)+20,Y(2)+5,'B');point(X(Math.PI),Y(2),'ode-endpoint');return{X,Y};}
 function field(){
  const {X,Y}=axes(0,3,-2.5,2.5),sx=620/3,sy=300/5;
  for(let t=0;t<=3.001;t+=.25)for(let y=-2;y<=2.001;y+=.4){const norm=Math.hypot(sx,y*sy),dx=9*sx/norm,dy=9*y*sy/norm;line([X(t)-dx,Y(y)-dy],[X(t)+dx,Y(y)+dy],'ode-field');}
  path(sample(t=>[X(t),Y(y0*Math.exp(-t))],0,3),'ode-reference');path(sample(t=>[X(t),Y(y0*Math.exp(-t))],0,3*u),'ode-solution');
  const t=3*u,y=y0*Math.exp(-t);point(X(t),Y(y));text(610,32,'y′ = −y');parameterValue.textContent=y0.toFixed(1);parameter.value=String(Math.round(y0*10));parameter.setAttribute('aria-valuetext',y0.toFixed(1));
  status.textContent='t = '+t.toFixed(2)+'　y(t) = '+y.toFixed(3);Object.assign(host.dataset,{time:String(t),value:String(y),initialValue:String(y0)});
 }
 function growth(){
  const lastValue=100*Math.exp(k*5),ymax=Math.max(110,lastValue*1.12),{X,Y}=axes(0,5,0,ymax,'t','N'),f=t=>100*Math.exp(k*t);
  path(sample(t=>[X(t),Y(f(t))],0,5),'ode-reference');path(sample(t=>[X(t),Y(f(t))],0,5*u),'ode-solution');point(X(5*u),Y(f(5*u)));text(560,32,'N(0) = 100');parameterValue.textContent=k.toFixed(2);parameter.value=String(Math.round(k*100));parameter.setAttribute('aria-valuetext',k.toFixed(2));
  status.textContent='t = '+(5*u).toFixed(2)+'　N(t) = '+f(5*u).toFixed(2);Object.assign(host.dataset,{time:String(5*u),value:String(f(5*u)),coefficient:String(k)});
 }
 function raceScene(){
  const {X,Y}=geometricAxes(),t=race.maxTime*u,route=(fn,cls)=>path(sample(v=>{const p=fn(v);return[X(p.x),Y(p.y)];},0,1,220),cls);
  route(v=>({x:Math.PI*v,y:2*v}),'ode-track-line');route(v=>{const phi=race.phiB*v;return{x:race.radius*(1-Math.cos(phi)),y:race.radius*Math.sin(phi)};},'ode-track-circle');route(v=>cycloid(Math.PI*v),'ode-track-cycloid');
  for(const [fn,cls]of [[race.lineAt,'ode-dot-line'],[race.circleAt,'ode-dot-circle'],[race.cycloidAt,'ode-dot-cycloid']]){const p=fn(t);point(X(p.x),Y(p.y),cls);}
  const times=[race.lineTime,race.circleTime,race.cycloidTime],outputs=host.querySelectorAll('.ode-race-times output');times.forEach((time,i)=>{outputs[i].textContent=time.toFixed(3)+' s';outputs[i].parentElement.classList.toggle('arrived',t>=time-1e-10);});
  progress.value=String(Math.round(u*1000));progressValue.textContent=t.toFixed(3)+' s';progress.setAttribute('aria-valuetext',t.toFixed(3)+' 秒');
  status.textContent=t>=race.cycloidTime?'曲线 C 已到达终点。':'三条路线从静止同时出发。';Object.assign(host.dataset,{time:String(t),lineTime:String(race.lineTime),circleTime:String(race.circleTime),cycloidTime:String(race.cycloidTime)});
 }
 function layers(){
  const {X,Y}=geometricAxes(),model=layeredRay(n);for(let i=0;i<n;i++)add('rect',{x:X(0),y:Y(2*i/n),width:Math.PI*145,height:290/n,fill:'#527b77','fill-opacity':.035+.25*i/n});
  for(let i=1;i<n;i++)line([X(0),Y(2*i/n)],[X(Math.PI),Y(2*i/n)],'ode-layer-boundary');
  path(model.points.map(p=>[X(p.x),Y(p.y)]),'ode-ray');
  const index=Math.floor(n*.6),p=model.points[index],angle=model.angles[index],cx=X(p.x),cy=Y(p.y),r=29;
  line([cx,cy],[cx,cy+55],'ode-guide');add('path',{d:'M'+cx+','+(cy+r)+'A'+r+','+r+' 0 0 0 '+(cx+r*Math.sin(angle))+','+(cy+r*Math.cos(angle)),class:'ode-angle'});text(cx+51*Math.sin(angle/2),cy+51*Math.cos(angle/2),'α');text(630,135,'慢');text(630,338,'快');
  parameterValue.textContent=n;parameter.value=String(n);status.textContent='层数越多，分层路线越接近连续的曲线。';Object.assign(host.dataset,{layers:String(n),snellConstant:String(model.p),endpointX:String(model.points[n].x),endpointY:String(model.points[n].y)});
 }
 function cycloidScene(){
  const theta=u*TAU,X=x=>70+80*x,Y=y=>60+80*y,p=cycloid(theta),cx=X(theta),cy=Y(1);
  arrow([55,60],[705,60]);arrow([70,45],[70,286]);text(719,65,'x');text(50,304,'y');
  path(sample(t=>{const q=cycloid(t);return[X(q.x),Y(q.y)];},0,TAU,240),'ode-reference');path(sample(t=>{const q=cycloid(t);return[X(q.x),Y(q.y)];},0,theta),'ode-solution');
  add('circle',{cx,cy,r:80,class:'ode-wheel'});line([cx,cy],[X(p.x),Y(p.y)],'ode-spoke');line([cx,60],[cx,cy],'ode-guide');point(X(p.x),Y(p.y));point(cx,cy,'ode-wheel-center');text(X(p.x)+17,Y(p.y)+25,'P');text(380,320,'x = θ − sin θ，y = 1 − cos θ');
  progress.value=String(Math.round(u*1000));progressValue.textContent=u>=1?'2π':theta.toFixed(2);progress.setAttribute('aria-valuetext',progressValue.textContent);status.textContent='示意取 R = 1，纵轴向下。';Object.assign(host.dataset,{theta:String(theta),pointX:String(p.x),pointY:String(p.y)});
 }
 function euler(){
  const {X,Y}=axes(0,3,0,1.2,'x','y'),points=eulerDecay(h),index=Math.min(points.length-1,Math.floor(u*(points.length-1)+1e-8)),p=points[index],lastPoint=points[points.length-1];
  path(sample(t=>[X(t),Y(Math.exp(-t))],0,3),'ode-solution');path(points.map(q=>[X(q.x),Y(q.y)]),'ode-euler-future');path(points.slice(0,index+1).map(q=>[X(q.x),Y(q.y)]),'ode-euler');
  point(X(p.x),Y(p.y),'ode-euler-point');text(575,35,'青：精确解　金：欧拉折线');select.value=String(h);stepButton.disabled=index>=points.length-1;
  status.textContent='x = 3 时：近似值 '+lastPoint.y.toFixed(4)+'，精确值 '+Math.exp(-3).toFixed(4);Object.assign(host.dataset,{step:String(h),index:String(index),pointX:String(p.x),pointY:String(p.y),endValue:String(lastPoint.y)});
 }
 function draw(){svg.replaceChildren();if(kind==='field')field();else if(kind==='growth')growth();else if(kind==='race')raceScene();else if(kind==='layers')layers();else if(kind==='cycloid')cycloidScene();else euler();host.dataset.progress=String(u);}
 function stop(){playing=false;cancelAnimationFrame(frame);play.textContent=kind==='layers'?'细分':'播放';play.setAttribute('aria-pressed','false');host.dataset.playing='false';}
 function tick(time){if(!playing)return;if(!host.isConnected||document.hidden||host.closest('[hidden]')){stop();return;}if(last){u=Math.min(1,u+Math.min(time-last,60)/(kind==='race'?6000:7000));if(kind==='layers')n=4+4*Math.min(11,Math.floor(u*11+1e-8));draw();}last=time;if(u>=1){stop();return;}frame=requestAnimationFrame(tick);}
 play.addEventListener('click',()=>{if(playing){stop();return;}if(u>=1){u=0;if(kind==='layers')n=4;}playing=true;last=0;play.textContent='暂停';play.setAttribute('aria-pressed','true');host.dataset.playing='true';frame=requestAnimationFrame(tick);});
 reset.addEventListener('click',()=>{stop();u=spec.initial;y0=1.5;k=.2;n=8;h=.5;draw();});
 if(parameter)parameter.addEventListener('input',()=>{stop();if(kind==='field')y0=Number(parameter.value)/10;else if(kind==='growth')k=Number(parameter.value)/100;else{n=Number(parameter.value);u=(n-4)/44;}draw();});
 if(progress)progress.addEventListener('input',()=>{stop();u=Number(progress.value)/1000;draw();});
 if(select)select.addEventListener('change',()=>{stop();h=Number(select.value);u=0;draw();});
 if(stepButton)stepButton.addEventListener('click',()=>{stop();const count=Math.round(3/h),index=Math.floor(u*count+1e-8);u=Math.min(1,(index+1)/count);draw();});
 instances.add({host,stop});draw();
}
function init(){for(const item of instances)if(!item.host.isConnected){item.stop();instances.delete(item);}document.querySelectorAll('[data-ode-motion]').forEach(setup);}
document.addEventListener('reader:chapter',init);document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const item of instances)item.stop();});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
