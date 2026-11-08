/* Local SVG teaching scenes. No external renderer, network or autoplay. */
(function () {
'use strict';
const NS='http://www.w3.org/2000/svg',TAU=2*Math.PI,instances=new Set();
let serial=0;
const specs={
 disk:{title:'圆盘微元',label:'截面位置 x',max:1,initial:.45},
 shell:{title:'柱壳微元',label:'柱壳半径 x',max:1,initial:.45},
 arc:{title:'弧长微元',label:'曲线位置 x',max:1,initial:.45},
 circle:{title:'用参数沿圆走一周',label:'参数 t',max:TAU,initial:.8},
 polar:{title:'沿心形线累积弧长',label:'角度 θ',max:TAU,initial:1.1},
 spring:{title:'小位移上的功',label:'压缩量 x',max:1,initial:.45},
 water:{title:'薄水层的功',label:'水层高度 x',max:1,initial:.45}
};
function setup(host){
 const kind=host.dataset.microelementMotion,spec=specs[kind];if(!spec||host.dataset.microReady)return;
 host.dataset.microReady='1';host.classList.add('teaching-motion','microelement-motion');
 const id='microelement-'+(++serial);
 host.innerHTML='<figcaption>'+spec.title+'</figcaption><div class="motion-controls"><label for="'+id+'">'+spec.label+'</label><input id="'+id+'" type="range" min="0" max="'+spec.max+'" step="0.01" value="'+spec.initial+'"><output for="'+id+'"></output><button type="button" class="micro-play" aria-pressed="false">播放</button><button type="button" class="micro-reset">重置</button></div><svg viewBox="0 0 720 400" role="img" aria-label="'+spec.title+'"></svg><p class="motion-values" aria-live="off"></p>';
 const input=host.querySelector('input'),out=host.querySelector('output'),play=host.querySelector('.micro-play'),reset=host.querySelector('.micro-reset'),svg=host.querySelector('svg'),status=host.querySelector('.motion-values');
 // Integer slider positions include both endpoints exactly, including 2π.
 const angular=spec.max===TAU,units=angular?628:100,initialIndex=Math.round(spec.initial/spec.max*units),initial=spec.max*initialIndex/units;
 input.max=String(units);input.step='1';input.value=String(initialIndex);
 let value=initial,playing=false,frame=0,previous=0;
 function add(tag,attrs,text,parent=svg){const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs||{}))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;parent.appendChild(e);return e;}
 function text(x,y,t,cls='micro-label'){return add('text',{x,y,class:cls},t);}
 function line(a,b,cls='micro-guide'){return add('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],class:cls});}
 function path(points,cls,closed=false){return add('path',{d:points.map((p,i)=>(i?'L':'M')+p.map(n=>n.toFixed(3)).join(',')).join('')+(closed?'Z':''),class:cls});}
 function sample(fn,lo,hi,n=80){return Array.from({length:n+1},(_,i)=>fn(lo+(hi-lo)*i/n));}
 function arrow(a,b,cls='micro-arrow'){line(a,b,cls);const angle=Math.atan2(b[1]-a[1],b[0]-a[0]),d=9;line(b,[b[0]-d*Math.cos(angle-.45),b[1]-d*Math.sin(angle-.45)],cls);line(b,[b[0]-d*Math.cos(angle+.45),b[1]-d*Math.sin(angle+.45)],cls);}
 function circle3(P,r,y,cls){return path(sample(t=>P(r*Math.cos(t),y,r*Math.sin(t)),0,TAU),cls,true);}
 function cylinder(P,r,y0,y1){
  const inner=Math.max(0,r-.018),outer=Math.min(1,r+.018);
  for(const radius of [inner,outer]){
   const lower=sample(t=>P(radius*Math.cos(t),y0,radius*Math.sin(t)),0,Math.PI),upper=sample(t=>P(radius*Math.cos(t),y1,radius*Math.sin(t)),Math.PI,0);
   path(lower.concat(upper),'micro-selected',true);circle3(P,radius,y0,'micro-gold-outline');
  }
  // An annular top face makes the hollow shell distinct from a solid cylinder.
  const outside=sample(t=>P(outer*Math.cos(t),y1,outer*Math.sin(t)),0,TAU),inside=sample(t=>P(inner*Math.cos(t),y1,inner*Math.sin(t)),TAU,0);
  const ring=path(outside,'micro-selected',true),hole=inside.map((p,i)=>(i?'L':'M')+p.map(n=>n.toFixed(3)).join(',')).join('')+'Z';
  ring.setAttribute('d',ring.getAttribute('d')+hole);ring.setAttribute('fill-rule','evenodd');
 }
 function diskScene(x){
  const P=(a,b,c)=>[85+300*a+36*c,220-104*b+29*c];
  // Surface of revolution of y=sqrt(x); meridians retain depth cues.
  for(let j=0;j<16;j++){const p=j*TAU/16,q=(j+1)*TAU/16;path(sample(a=>P(a,Math.sqrt(a)*Math.cos(p),Math.sqrt(a)*Math.sin(p)),0,1,40).concat(sample(a=>P(a,Math.sqrt(a)*Math.cos(q),Math.sqrt(a)*Math.sin(q)),1,0,40)),'micro-surface',true);}
  for(let j=0;j<8;j++)path(sample(a=>P(a,Math.sqrt(a)*Math.cos(j*TAU/8),Math.sqrt(a)*Math.sin(j*TAU/8)),0,1,60),'micro-wire');
  const cross=a=>sample(t=>P(a,Math.sqrt(a)*Math.cos(t),Math.sqrt(a)*Math.sin(t)),0,TAU);
  path(cross(1),'micro-outline',true);
  const lo=Math.max(0,x-.018),hi=Math.min(1,x+.018);
  for(let j=0;j<16;j++){const p=j*TAU/16,q=(j+1)*TAU/16;path([P(lo,Math.sqrt(lo)*Math.cos(p),Math.sqrt(lo)*Math.sin(p)),P(hi,Math.sqrt(hi)*Math.cos(p),Math.sqrt(hi)*Math.sin(p)),P(hi,Math.sqrt(hi)*Math.cos(q),Math.sqrt(hi)*Math.sin(q)),P(lo,Math.sqrt(lo)*Math.cos(q),Math.sqrt(lo)*Math.sin(q))],'micro-selected',true);}
  path(cross(x),'micro-selected',true);arrow([65,220],[430,220],'micro-axis');text(443,225,'x');text(85,250,'0');text(385,250,'1');
  const rim=P(x,-Math.sqrt(x),0);line(rim,[rim[0],355]);text(rim[0],381,'dx');
  add('circle',{cx:566,cy:190,r:88*Math.sqrt(x),class:'micro-selected'});line([566,190],[566+88*Math.sqrt(x),190],'micro-gold-outline');
  text(566,65,'截面');text(566,315,'r = √x');text(566,355,'dV = πx dx');
  host.dataset.coefficient=String(Math.PI*x);status.textContent='x = '+x.toFixed(2)+'　截面面积 = '+(Math.PI*x).toFixed(3);
 }
 function shellScene(x){
  const P=(a,b,c)=>[230+112*a+48*c,320-240*b+27*c];
  const top=sample(t=>P(Math.cos(t),1,Math.sin(t)),0,TAU);
  path([P(0,0,0)].concat(sample(t=>P(Math.cos(t),1,Math.sin(t)),0,Math.PI)),'micro-surface',true);
  circle3(P,1,1,'micro-outline');line(P(-1,1,0),P(0,0,0),'micro-outline');line(P(1,1,0),P(0,0,0),'micro-outline');
  cylinder(P,x,x,1);arrow(P(0,0,0),P(0,1.1,0),'micro-axis');text(230,35,'y');
  line(P(0,x,0),P(x,x,0),'micro-gold-outline');text(240+56*x,340-240*x,'x');
  const w=210*x,h=190*(1-x),rx=560-w/2,ry=185-h/2;
  add('rect',{x:rx,y:ry,width:w,height:h,class:'micro-selected'});text(560,60,'展开薄壳');text(560,ry-18,'2πx');text(682,190,'1 − x');text(560,340,'厚度 dx');text(560,377,'dV = 2πx(1 − x) dx');
  host.dataset.coefficient=String(2*Math.PI*x*(1-x));status.textContent='x = '+x.toFixed(2)+'　薄壳高度 = '+(1-x).toFixed(2);
 }
 function arcScene(t){
  let position,velocity,domain,bounds,unit;
  if(kind==='arc'){position=s=>[s,Math.pow(s,1.5)];velocity=s=>[1,1.5*Math.sqrt(s)];domain=1;bounds=[-.12,1.12,-.12,1.12];unit='';}
  else if(kind==='circle'){position=s=>[Math.cos(s),Math.sin(s)];velocity=s=>[-Math.sin(s),Math.cos(s)];domain=TAU;bounds=[-1.3,1.3,-1.3,1.3];unit='示意取 R = 1　';}
  else{position=s=>[(1+Math.cos(s))*Math.cos(s),(1+Math.cos(s))*Math.sin(s)];velocity=s=>[-Math.sin(s)*(1+2*Math.cos(s)),Math.cos(s)+Math.cos(2*s)];domain=TAU;bounds=[-.9,2.3,-1.6,1.6];unit='示意取 a = 1　';}
  const [xmin,xmax,ymin,ymax]=bounds,scale=285/(xmax-xmin),X=x=>70+(x-xmin)*scale,Y=y=>335-(y-ymin)*scale;
  arrow([60,Y(0)],[390,Y(0)],'micro-axis');arrow([X(0),350],[X(0),35],'micro-axis');text(402,Y(0)+6,'x');text(X(0)-16,25,'y');
  path(sample(s=>{const p=position(s);return[X(p[0]),Y(p[1])];},0,domain,240),'micro-outline');
  path(sample(s=>{const p=position(s);return[X(p[0]),Y(p[1])];},0,t,Math.max(2,Math.ceil(t/domain*150))),'micro-trace');
  const p=position(t),d=velocity(t),speed=Math.hypot(...d),delta=domain===1?.055:.1;
  const lo=Math.max(0,t-delta/2),hi=Math.min(domain,t+delta/2);
  path(sample(s=>{const q=position(s);return[X(q[0]),Y(q[1])];},lo,hi,14),'micro-small-arc');add('circle',{cx:X(p[0]),cy:Y(p[1]),r:5,class:'micro-point'});
  text(X(p[0])+15,Y(p[1])-13,'P');
  text(560,60,'放大的弧长微元');
  const factor=speed>1e-8?155/speed:0,dx=d[0]*factor,dy=-d[1]*factor;
  const a=[560-dx/2,205-dy/2],b=[560+dx/2,205+dy/2],corner=[b[0],a[1]];
  line(a,corner,'micro-gold-guide');line(corner,b,'micro-gold-guide');line(a,b,'micro-small-arc');
  text(560,Math.max(a[1],b[1])+29,'dx');text(Math.max(a[0],b[0])+28,213,'dy');
  let nx=-dy/155,ny=dx/155;if(ny>0||(Math.abs(ny)<.1&&nx>0)){nx=-nx;ny=-ny;}text(560+30*nx,205+30*ny,'ds');
  text(560,340,'ds = √(dx² + dy²)');
  host.dataset.coefficient=String(speed);host.dataset.pointX=String(p[0]);host.dataset.pointY=String(p[1]);status.textContent=unit+(kind==='arc'?'x':'t')+' = '+t.toFixed(2)+'　微元系数 = '+speed.toFixed(3);
 }
 function springScene(x){
  const left=72,right=352-150*x,y=185;line([left,115],[left,265],'micro-outline');
  for(let i=0;i<7;i++)line([left-18,125+20*i],[left,115+20*i],'micro-guide');
  const coil=[[left,y],[left+18,y]];for(let i=0;i<=18;i++)coil.push([left+28+(right-left-56)*i/18,y+(i%2?26:-26)]);coil.push([right-12,y],[right,y]);path(coil,'micro-outline');
  line([352,112],[352,270]);line([right,135],[right,235],'micro-gold-outline');arrow([right+90,y],[right+4,y]);text(right+62,y-18,'F');
  line([right,282],[352,282],'micro-gold-outline');text((right+352)/2,311,'x');text(210,62,'弹簧压缩');
  const X=a=>475+170*a,Y=b=>300-170*b;arrow([462,300],[675,300],'micro-axis');arrow([475,315],[475,90],'micro-axis');text(687,304,'x');text(475,70,'F');
  path([[X(0),Y(0)],[X(x),Y(x)],[X(x),Y(0)]],'micro-surface',true);line([X(0),Y(0)],[X(1),Y(1)],'micro-outline');
  const hi=Math.min(1,x+.035);path([[X(x),Y(0)],[X(hi),Y(0)],[X(hi),Y(x)],[X(x),Y(x)]],'micro-selected',true);add('circle',{cx:X(x),cy:Y(x),r:4,class:'micro-point'});text(570,355,'dW = F(x) dx');
  host.dataset.coefficient=String(x);status.textContent='示意取 k = 1、L = 1　x = '+x.toFixed(2)+'　F(x) = '+x.toFixed(2);
 }
 function waterScene(x){
  const cx=230,top=80,bottom=320,r=104,ry=25,y=bottom-(bottom-top)*x;
  add('rect',{x:cx-r,y:top,width:2*r,height:bottom-top,class:'micro-water'});add('ellipse',{cx,cy:bottom,rx:r,ry,class:'micro-water'});
  add('ellipse',{cx,cy:top,rx:r,ry,class:'micro-outline'});add('ellipse',{cx,cy:bottom,rx:r,ry,class:'micro-outline'});line([cx-r,top],[cx-r,bottom],'micro-outline');line([cx+r,top],[cx+r,bottom],'micro-outline');
  add('rect',{x:cx-r,y:y-5,width:2*r,height:10,class:'micro-selected'});add('ellipse',{cx,cy:y-5,rx:r,ry,class:'micro-selected'});
  line([cx+r+18,y],[cx+r+47,y]);line([cx+r+18,top],[cx+r+47,top]);arrow([cx+r+36,y],[cx+r+36,top]);text(427,(y+top)/2,'H − x');
  line([99,bottom],[99,y],'micro-gold-outline');text(79,(bottom+y)/2,'x');text(230,37,'圆柱形水箱');
  add('ellipse',{cx:573,cy:190,rx:86,ry:23,class:'micro-selected'});add('path',{d:'M487 190v15a86 23 0 0 0 172 0v-15',class:'micro-gold-outline'});text(573,120,'薄水层');text(573,249,'厚度 dx');text(573,310,'质量 ρπR² dx');text(573,360,'功 = 重力 × 提升距离');
  host.dataset.coefficient=String(1-x);status.textContent='x = '+x.toFixed(2)+'H　提升距离 = '+(1-x).toFixed(2)+'H';
 }
 function draw(){svg.replaceChildren();const formatted=angular&&value>=spec.max-1e-9?'2π':value.toFixed(2);out.textContent=formatted;input.value=String(Math.round(value/spec.max*units));input.setAttribute('aria-valuetext',formatted);host.dataset.parameter=String(value);
  if(kind==='disk')diskScene(value);else if(kind==='shell')shellScene(value);else if(['arc','circle','polar'].includes(kind))arcScene(value);else if(kind==='spring')springScene(value);else waterScene(value);
 }
 function stop(){playing=false;cancelAnimationFrame(frame);play.textContent='播放';play.setAttribute('aria-pressed','false');host.dataset.playing='false';}
 function tick(time){if(!playing)return;if(!host.isConnected||document.hidden||host.closest('[hidden]')){stop();return;}
  if(previous){value=Math.min(spec.max,value+Math.min(time-previous,50)*spec.max/7000);draw();}previous=time;
  if(value>=spec.max){stop();return;}frame=requestAnimationFrame(tick);
 }
 input.addEventListener('input',()=>{stop();value=spec.max*Number(input.value)/units;draw();});
 play.addEventListener('click',()=>{if(playing){stop();return;}if(value>=spec.max-.005)value=0;playing=true;previous=0;play.textContent='暂停';play.setAttribute('aria-pressed','true');host.dataset.playing='true';frame=requestAnimationFrame(tick);});
 reset.addEventListener('click',()=>{stop();value=initial;draw();});
 instances.add({host,stop});draw();
}
function init(){for(const instance of instances)if(!instance.host.isConnected){instance.stop();instances.delete(instance);}document.querySelectorAll('[data-microelement-motion]').forEach(setup);}
document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const instance of instances)instance.stop();});
document.addEventListener('reader:chapter',init);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
