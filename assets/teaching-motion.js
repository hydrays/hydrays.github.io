/* Local, dependency-free teaching figures. Works after reader chapter swaps. */
(function(){
'use strict';
const NS='http://www.w3.org/2000/svg';
let serial=0;
const specs={
 slice:{title:'圆锥的截面怎样变化？',label:'截面高度 x（高取 1）',min:0,max:1,step:.01,value:.35},
 mean:{title:'寻找与割线平行的切线',label:'切点横坐标 c',min:.05,max:1.95,step:.01,value:.45},
 taylor:{title:'用多项式贴近曲线',label:'多项式次数 n',min:1,max:9,step:1,value:3},
 cooling:{title:'温差怎样随时间衰减？',label:'冷却系数 k',min:.05,max:1,step:.05,value:.2}
};

function setupRiemann(host){
 const id='riemann-pair-'+(++serial),points=[];
 for(let n=4;n<=128;n+=4){const dx=2*Math.SQRT2/n;let sum=0;for(let i=1;i<=n;i++)sum+=Math.sqrt(Math.max(0,2-(i*dx-Math.SQRT2)**2))*dx;points.push({n,sum});}
 host.classList.add('teaching-motion','riemann-pair');
 host.innerHTML='<div class="motion-controls"><label for="'+id+'">n</label><input id="'+id+'" aria-label="分割数 n" type="range" min="4" max="128" step="4" value="24"><output for="'+id+'">24</output><button type="button" aria-pressed="false">播放</button></div><div class="riemann-panels"><svg viewBox="0 0 600 600" role="img" aria-label="半圆的矩形逼近"></svg><svg viewBox="0 0 600 600" role="img" aria-label="黎曼和的离散点"></svg></div><p class="motion-values" aria-live="off"></p>';
 const input=host.querySelector('input'),out=host.querySelector('output'),button=host.querySelector('button'),svgs=host.querySelectorAll('svg'),status=host.querySelector('.motion-values');let playing=false,frame=0,last=0;
 function stop(){playing=false;cancelAnimationFrame(frame);button.textContent='播放';button.setAttribute('aria-pressed','false');}
 function add(svg,tag,attrs,text){const node=document.createElementNS(NS,tag);Object.entries(attrs||{}).forEach(([k,v])=>node.setAttribute(k,v));if(text!==undefined)node.textContent=text;svg.appendChild(node);return node;}
 function line(svg,x1,y1,x2,y2,cls){add(svg,'line',{x1,y1,x2,y2,class:cls||'motion-axis'});}
 function text(svg,x,y,value){add(svg,'text',{x,y,class:'motion-label'},value);}
 function draw(){const n=Number(input.value),current=points.find(p=>p.n===n),left=svgs[0],right=svgs[1],scale=470/(2*Math.SQRT2),X=x=>65+x*scale,Y=y=>440-y*scale,dx=2*Math.SQRT2/n;out.textContent=n;svgs.forEach(svg=>svg.replaceChildren());
 line(left,65,440,550,440);line(left,65,75,65,440);
 for(let i=0;i<=4;i++){const x=i*Math.SQRT2/2;line(left,X(x),437,X(x),443);text(left,X(x),466,Number(x.toFixed(2)));}
 for(let y=.5;y<=2;y+=.5){line(left,62,Y(y),68,Y(y));text(left,42,Y(y)+5,y);}
 const f=x=>Math.sqrt(Math.max(0,2-(x-Math.SQRT2)**2));for(let i=1;i<=n;i++){const h=f(i*dx);add(left,'rect',{x:X((i-1)*dx),y:Y(h),width:dx*scale,height:h*scale,class:'motion-rect'});}
 let d='';for(let i=0;i<=240;i++){const x=2*Math.SQRT2*i/240;d+=(i?'L':'M')+X(x)+','+Y(f(x));}add(left,'path',{d,class:'motion-curve'});text(left,554,443,'x');text(left,65,60,'y');
 const U=n=>65+n/128*470,V=sum=>480-(sum-2.65)/.55*390;
 line(right,65,480,550,480);line(right,65,70,65,480);
 for(const n of [0,32,64,96,128]){line(right,U(n),477,U(n),483);text(right,U(n),508,n);}
 for(let sum=2.7;sum<3.2;sum+=.1){line(right,62,V(sum),68,V(sum));text(right,35,V(sum)+5,sum.toFixed(1));}
 line(right,U(0),V(Math.PI),U(128),V(Math.PI),'motion-chord');text(right,550,V(Math.PI)-10,'π');
 for(const point of points){if(point.n>n)break;add(right,'circle',{cx:U(point.n),cy:V(point.sum),r:point.n===n?6:3.4,class:'motion-dot','data-n':point.n,'data-sum':point.sum});}
 text(right,65,45,'Sₙ');text(right,560,485,'n');status.textContent='Sₙ = '+current.sum.toFixed(6)+'　π − Sₙ = '+(Math.PI-current.sum).toFixed(6);
 }
 input.addEventListener('input',()=>{stop();draw();});
 button.addEventListener('click',()=>{if(playing){stop();return;}if(Number(input.value)>=128)input.value='4';playing=true;button.textContent='暂停';button.setAttribute('aria-pressed','true');last=0;draw();
 function tick(time){if(!playing)return;if(!host.isConnected){stop();return;}if(time-last>180){last=time;input.value=String(Math.min(128,Number(input.value)+4));draw();if(Number(input.value)>=128){stop();return;}}frame=requestAnimationFrame(tick);}frame=requestAnimationFrame(tick);
 });draw();
}

function setupAccumulation(host){
 const id='accumulation-'+(++serial),a=.45,delta=.2,steps=16;
 const grid=i=>Number((a+i*delta).toFixed(10)),maximum=grid(steps),initial=grid(11);
 const f=t=>3-.9*(t-2)**2;
 // Analytic primitive: no rectangle-area summation or numerical quadrature.
 const F=t=>3*t-.3*(t-2)**3,A=t=>F(t)-F(a);
 let current=initial,base=grid(10),playing=false,tween=null,frame=0,holdUntil=0;
 host.classList.add('teaching-motion','accumulation-pair');
 host.innerHTML='<div class="motion-controls"><label for="'+id+'">积分上限</label><input id="'+id+'" type="range" min="'+a+'" max="'+maximum+'" step="'+delta+'" value="'+initial+'"><output for="'+id+'"></output><button type="button" class="accumulation-step">增加一小步</button><button type="button" class="accumulation-play" aria-pressed="false">播放</button><button type="button" class="accumulation-reset">从头</button></div><div class="accumulation-panels"><svg viewBox="0 0 440 360" role="img" aria-label="凹函数f、当前函数值与新增的窄条面积"></svg><svg viewBox="0 0 440 360" role="img" aria-label="累积面积函数A、切线与当前斜率"></svg></div>';
 const input=host.querySelector('input'),out=host.querySelector('output'),stepButton=host.querySelector('.accumulation-step'),playButton=host.querySelector('.accumulation-play'),resetButton=host.querySelector('.accumulation-reset'),svgs=host.querySelectorAll('svg');
 const X=t=>56+87*t,Yf=y=>285-69*y,YA=y=>285-29*y;
 function add(svg,tag,attrs,text){const node=document.createElementNS(NS,tag);Object.entries(attrs||{}).forEach(([k,v])=>node.setAttribute(k,v));if(text!==undefined)node.textContent=text;svg.appendChild(node);return node;}
 function line(svg,x1,y1,x2,y2,cls){return add(svg,'line',{x1,y1,x2,y2,class:cls||'motion-axis'});}
 function label(svg,x,y,text,cls){return add(svg,'text',{x,y,class:cls||'accumulation-label'},text);}
 function pathData(fn,lo,hi,Y){let d='';for(let i=0;i<=180;i++){const t=lo+(hi-lo)*i/180;d+=(i?'L':'M')+X(t).toFixed(3)+','+Y(fn(t)).toFixed(3);}return d;}
 function areaData(lo,hi){return pathData(f,lo,hi,Yf)+'L'+X(hi)+',285L'+X(lo)+',285Z';}
 function axes(svg,dependent,independent){line(svg,48,285,408,285,'accumulation-axis');line(svg,56,285,56,48,'accumulation-axis');add(svg,'path',{d:'M401 281L408 285L401 289 M52 55L56 48L60 55',class:'accumulation-axis'});label(svg,411,312,independent);label(svg,56,29,dependent,'accumulation-title');}
 function movingValue(svg,px,py,value,kind){
  const width=184,height=34,x=Math.max(73,Math.min(430-width,px+width+13>430?px-width-13:px+13)),y=Math.max(43,Math.min(242,py-49));
  const group=add(svg,'g',{class:'accumulation-value '+kind,transform:'translate('+x+','+y+')'});
  add(group,'rect',{width,height,rx:4,class:'accumulation-value-background'});
  label(group,10,25,value,'accumulation-value-text');
 }
 function endLabels(svg){
  const sameBase=Math.abs(base-a)<1e-7;
  label(svg,X(a),base-a<.35&&!sameBase?340:313,sameBase?'a = x':'a');
  if(!sameBase)label(svg,X(base)-5,313,'x');
  if(current-base>1e-7){const tx=Math.min(370,X(current)+32);add(svg,'path',{d:'M'+X(current)+',289L'+(tx-24)+',326H'+(tx-15),class:'accumulation-guide'});label(svg,tx+11,345,'x + Δx');}
 }
 function draw(){
  svgs.forEach(svg=>svg.replaceChildren());const left=svgs[0],right=svgs[1],dx=current-base,increment=A(current)-A(base),slope=f(current);
  out.textContent=current.toFixed(3);input.value=String(current);
  Object.assign(host.dataset,{currentX:String(current),incrementStart:String(base),accumulation:String(A(current)),areaIncrement:String(increment),slope:String(slope),functionValue:String(slope),stepWidth:String(delta),animating:String(!!tween)});
  axes(left,'f(t)','t');
  add(left,'path',{d:areaData(a,base),class:'accumulation-area'});
  if(dx>1e-7){add(left,'path',{d:areaData(base,current),class:'accumulation-increment'});add(left,'rect',{x:X(base),y:Yf(f(base)),width:87*dx,height:285-Yf(f(base)),class:'accumulation-rectangle'});}
  line(left,56,Yf(f(base)),X(base),Yf(f(base)),'motion-dashed');label(left,29,Yf(f(base))+7,'f(x)');
  line(left,X(base),285,X(base),Yf(f(base)),'motion-dashed');line(left,X(current),285,X(current),Yf(f(current)),'motion-dashed');
  add(left,'path',{d:pathData(f,a,maximum,Yf),class:'motion-curve'});add(left,'circle',{cx:X(current),cy:Yf(f(current)),r:4.5,class:'accumulation-current'});
  if(base-a>.5)label(left,X((a+base)/2),246,'A(x)');
  if(dx>1e-7){const y=285-.45*69*Math.min(f(base),slope);line(left,X((base+current)/2),y,371,y,'accumulation-guide');label(left,402,y+7,'ΔA');}
  movingValue(left,X(current),Yf(slope),'f(t) = '+slope.toFixed(3),'accumulation-function-value');
  endLabels(left);
  axes(right,'A(x)','x');
  add(right,'path',{d:pathData(A,a,maximum,YA),class:'accumulation-future'});
  add(right,'path',{d:pathData(A,a,base,YA),class:'motion-curve'});
  if(dx>1e-7)add(right,'path',{d:pathData(A,base,current,YA),class:'accumulation-new-curve'});
  line(right,X(base),285,X(base),YA(A(base)),'motion-dashed');line(right,X(current),285,X(current),YA(A(current)),'motion-dashed');
  if(dx>1e-7){line(right,X(base),YA(A(base)),X(current)+15,YA(A(base)),'motion-dashed');add(right,'path',{d:'M'+(X(current)+10)+','+YA(A(base))+'h10 M'+(X(current)+10)+','+YA(A(current))+'h10 M'+(X(current)+15)+','+YA(A(base))+'V'+YA(A(current)),class:'accumulation-guide'});label(right,Math.min(406,X(current)+44),(YA(A(base))+YA(A(current)))/2+6,'ΔA');}
  const tangent=t=>A(current)+slope*(t-current);
  add(right,'path',{d:pathData(tangent,Math.max(a,current-.5),Math.min(maximum,current+.5),YA),class:'motion-tangent'});
  add(right,'circle',{cx:X(base),cy:YA(A(base)),r:3.6,class:'accumulation-previous'});add(right,'circle',{cx:X(current),cy:YA(A(current)),r:5.3,class:'accumulation-current'});
  movingValue(right,X(current),YA(A(current)),'斜率 = '+slope.toFixed(3),'accumulation-slope-value');endLabels(right);
  stepButton.disabled=!!tween||current>=maximum-1e-8;playButton.textContent=playing?'暂停':'播放';playButton.setAttribute('aria-pressed',String(playing));
 }
 function stop(){playing=false;tween=null;cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',onVisibility);draw();}
 function onVisibility(){if(document.hidden)stop();}
 function startStep(){if(current>=maximum-1e-8){stop();return;}const cell=Math.min(steps-1,Math.floor((current-a)/delta+1e-8));base=grid(cell);tween={from:current,to:grid(cell+1),start:null};draw();document.addEventListener('visibilitychange',onVisibility);frame=requestAnimationFrame(tick);}
 function tick(time){
  if(!host.isConnected){playing=false;tween=null;document.removeEventListener('visibilitychange',onVisibility);return;}
  if(!tween){if(playing&&time>=holdUntil){startStep();return;}if(playing)frame=requestAnimationFrame(tick);return;}
  if(tween.start===null)tween.start=time;
  const p=Math.min(1,(time-tween.start)/650),smooth=p*p*(3-2*p);current=tween.from+(tween.to-tween.from)*smooth;
  if(p===1){current=tween.to;tween=null;holdUntil=time+180;}
  draw();
  if(tween||playing){if(!tween&&current>=maximum-1e-8){stop();return;}frame=requestAnimationFrame(tick);}else document.removeEventListener('visibilitychange',onVisibility);
 }
 input.addEventListener('input',()=>{const selected=Number(input.value);stop();const cell=Math.max(0,Math.min(steps,Math.round((selected-a)/delta)));current=grid(cell);base=grid(Math.max(0,cell-1));draw();});
 stepButton.addEventListener('click',()=>{stop();startStep();});
 playButton.addEventListener('click',()=>{if(playing){stop();return;}stop();if(current>=maximum-1e-8){current=a;base=a;}playing=true;startStep();});
 resetButton.addEventListener('click',()=>{stop();current=a;base=a;draw();});
 draw();
}

function init(){document.querySelectorAll('[data-teaching-motion]').forEach(host=>{
 if(host.dataset.ready)return;host.dataset.ready='1';
 const kind=host.dataset.teachingMotion;if(kind==='riemann'){setupRiemann(host);return;}if(kind==='accumulation'){setupAccumulation(host);return;}const spec=specs[kind];if(!spec)return;
 const id='teaching-motion-'+(++serial);host.classList.add('teaching-motion');
 const viewBox='0 0 720 350';
 host.innerHTML='<figcaption>'+spec.title+'</figcaption><div class="motion-controls"><label for="'+id+'">'+spec.label+'</label><input id="'+id+'" type="range" min="'+spec.min+'" max="'+spec.max+'" step="'+spec.step+'" value="'+spec.value+'"><output for="'+id+'"></output><button type="button" aria-pressed="false">播放</button><button type="button" class="motion-reset">重置</button></div><svg viewBox="'+viewBox+'" role="img" aria-label="'+spec.title+'"></svg><p class="motion-values" role="status" aria-live="off"></p>';
 const input=host.querySelector('input'),out=host.querySelector('output'),buttons=host.querySelectorAll('button'),svg=host.querySelector('svg'),status=host.querySelector('.motion-values');
 let playing=false,frame=0,last=0,direction=1;
 function stop(){playing=false;cancelAnimationFrame(frame);buttons[0].textContent='播放';buttons[0].setAttribute('aria-pressed','false');}
 function el(tag,attrs,text){const e=document.createElementNS(NS,tag);Object.entries(attrs||{}).forEach(([k,v])=>e.setAttribute(k,v));if(text!==undefined)e.textContent=text;svg.appendChild(e);return e;}
 const line=(x1,y1,x2,y2,cls)=>el('line',{x1,y1,x2,y2,class:cls||'motion-axis'});
 const label=(x,y,t,cls)=>el('text',{x,y,class:cls||'motion-label'},t);
 function plot(xmin,xmax,ymin,ymax){const X=x=>60+(x-xmin)/(xmax-xmin)*610,Y=y=>295-(y-ymin)/(ymax-ymin)*260;
 line(60,Y(0),680,Y(0));line(X(0),30,X(0),300);
 for(let i=0;i<=4;i++){let x=xmin+(xmax-xmin)*i/4;line(X(x),Y(0)-3,X(x),Y(0)+3);label(X(x),Y(0)+22,Number(x.toFixed(2)));}
 for(let i=0;i<=4;i++){let y=ymin+(ymax-ymin)*i/4;line(X(0)-3,Y(y),X(0)+3,Y(y));if(Math.abs(y)>1e-8)label(X(0)-20,Y(y)+5,Number(y.toFixed(2)));}
 return {X,Y};}
 function path(f,x0,x1,X,Y,cls){let d='';for(let i=0;i<=240;i++){let x=x0+(x1-x0)*i/240;d+=(i?'L':'M')+X(x).toFixed(2)+','+Y(f(x)).toFixed(2);}el('path',{d,class:cls||'motion-curve'});}
 function draw(){const v=Number(input.value);out.textContent=kind==='slice'||kind==='mean'?v.toFixed(2):kind==='cooling'?v.toFixed(2):v;svg.replaceChildren();
 if(kind==='slice'){
 // Cone vertex at x=1; height increases from the base, matching the source figure.
 const apex=[235,40],baseY=285,left=100,right=370,cx=235,cy=baseY-(baseY-40)*v,r=(right-cx)*(1-v);
 el('path',{d:'M'+left+','+baseY+'L'+apex[0]+','+apex[1]+'L'+right+','+baseY,class:'motion-curve'});
 el('ellipse',{cx,cy:baseY,rx:135,ry:24,class:'motion-outline'});
 line(cx,baseY,cx,40,'motion-dashed');el('ellipse',{cx,cy,rx:Math.max(r,.1),ry:Math.max(24*(1-v),.1),class:'motion-slice'});
 line(cx,cy,cx+r,cy,'motion-gold');label(cx+r/2,cy-13,'r(x) = 1 − x');
 line(77,baseY,77,cy,'motion-gold');label(60,(cy+baseY)/2,'x');
 el('circle',{cx:555,cy:165,r:Math.max(100*(1-v),.1),class:'motion-slice'});label(555,310,'截面面积 A(x) = π(1 − x)²');
 status.textContent='底半径、高均取 1　x = '+v.toFixed(2)+'　r(x) = '+(1-v).toFixed(2)+'　A(x) = '+(Math.PI*(1-v)**2).toFixed(4);
 }else if(kind==='mean'){
 const {X,Y}=plot(0,2,0,4.8);path(x=>x*x,0,2,X,Y);path(x=>2*x,0,2,X,Y,'motion-chord');
 let lo=Math.max(0,v-.55),hi=Math.min(2,v+.55);path(x=>v*v+2*v*(x-v),lo,hi,X,Y,'motion-tangent');el('circle',{cx:X(v),cy:Y(v*v),r:6,class:'motion-dot'});label(540,40,'f(x) = x²');label(540,68,'割线斜率 = 2');
 status.textContent='c = '+v.toFixed(2)+'　切线斜率 2c = '+(2*v).toFixed(2)+'　割线斜率 = 2'+(Math.abs(v-1)<.005?'　两条线平行':'');
 }else if(kind==='taylor'){
 const n=Math.round(v),{X,Y}=plot(-2,2,-.5,8);let poly=x=>{let t=1,sum=1;for(let k=1;k<=n;k++){t*=x/k;sum+=t;}return sum;};
 path(Math.exp,-2,2,X,Y);path(poly,-2,2,X,Y,'motion-tangent');label(185,35,'原函数 eˣ（实线）');label(490,35,'泰勒多项式（虚线）');
 status.textContent='n = '+n+'　x = 1 时：e ≈ '+Math.E.toFixed(6)+'，多项式值 = '+poly(1).toFixed(6)+'，差值 = '+Math.abs(Math.E-poly(1)).toExponential(2);
 }else if(kind==='cooling'){
 const {X,Y}=plot(0,15,0,100),f=t=>20+60*Math.exp(-v*t);path(f,0,15,X,Y);line(X(0),Y(20),X(15),Y(20),'motion-chord');label(550,55,'初温 80 ℃，环境 20 ℃');label(560,Y(20)-12,'环境温度');label(665,Y(0)+42,'t（分钟）');
 status.textContent='T(t) = 20 + 60e⁻ᵏᵗ　k = '+v.toFixed(2)+'　5 分钟后温度 = '+f(5).toFixed(2)+' ℃';
 }
 }
 input.addEventListener('input',()=>{stop();draw();});
 buttons[0].addEventListener('click',()=>{if(playing){stop();return;}playing=true;buttons[0].textContent='暂停';buttons[0].setAttribute('aria-pressed','true');last=0;
 function tick(time){if(!playing)return;if(!host.isConnected){stop();return;}if(time-last>140){last=time;let next=Number(input.value)+direction*spec.step;if(next>spec.max||next<spec.min){direction*=-1;next=Number(input.value)+direction*spec.step;}input.value=String(next);draw();}frame=requestAnimationFrame(tick);}frame=requestAnimationFrame(tick);
 });
 buttons[1].addEventListener('click',()=>{stop();input.value=String(spec.value);direction=1;draw();});draw();
 });}
 document.addEventListener('reader:chapter',init);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
