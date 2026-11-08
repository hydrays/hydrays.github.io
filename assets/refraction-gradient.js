/* Linked route / objective / tangent, followed by a fair step-size comparison. */
(function () {
  'use strict';
  const M=window.RefractionGradientModel;
  if(!M)return;
  window.refractionGradientAnimationsLoaded=true;
  const NS='http://www.w3.org/2000/svg',active=new Set();
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let serial=0;
  function el(parent,tag,attrs,value) {
    const n=document.createElementNS(NS,tag);
    Object.entries(attrs||{}).forEach(([k,v])=>n.setAttribute(k,String(v)));
    if(value!==undefined)n.textContent=String(value);
    parent.appendChild(n);return n;
  }
  function line(p,x1,y1,x2,y2,cls) {return el(p,'line',{x1,y1,x2,y2,class:cls});}
  function text(p,value,x,y,cls,anchor) {
    return el(p,'text',{x,y,class:cls||'', 'text-anchor':anchor||'middle'},value);
  }
  function fmt(n,digits) {return (Math.abs(n)<.5*Math.pow(10,-digits)?0:n).toFixed(digits);}
  function mix(a,b,t) {return a+(b-a)*t;}
  function smooth(t) {return t*t*(3-2*t);}
  function arrow(p,x1,y1,x2,y2,cls) {
    if(Math.hypot(x2-x1,y2-y1)<3)return;
    const angle=Math.atan2(y2-y1,x2-x1),size=8;
    line(p,x1,y1,x2,y2,cls);
    el(p,'path',{d:'M'+(x2-size*Math.cos(angle-.45))+','+(y2-size*Math.sin(angle-.45))
      +' L'+x2+','+y2+' L'+(x2-size*Math.cos(angle+.45))+','+(y2-size*Math.sin(angle+.45)),class:cls});
  }
  function clip(svg,id,L,T,R,B) {
    const defs=el(svg,'defs'),c=el(defs,'clipPath',{id:id});
    el(c,'rect',{x:L,y:T,width:R-L,height:B-T});
    return el(svg,'g',{'clip-path':'url(#'+id+')'});
  }
  function sampledPath(svg,fn,lo,hi,X,Y,cls) {
    const points=[];
    for(let i=0;i<=180;i++) {
      const x=mix(lo,hi,i/180);
      points.push((i?'L':'M')+X(x).toFixed(3)+','+Y(fn(x)).toFixed(3));
    }
    return el(svg,'path',{d:points.join(' '),class:cls});
  }
  function axes(svg,L,T,R,B,X,Y,xTicks,yTicks,xName,yName) {
    xTicks.forEach(x=>{line(svg,X(x),T,X(x),B,'gd-grid');text(svg,x,X(x),B+27,'gd-small-text');});
    yTicks.forEach(y=>{line(svg,L,Y(y),R,Y(y),'gd-grid');text(svg,y,L-13,Y(y)+7,'gd-small-text','end');});
    arrow(svg,L,B,R+10,B,'gd-axis');arrow(svg,L,B,L,T-9,'gd-axis');
    text(svg,xName,R+22,B+9,'gd-small-text');text(svg,yName,L,T-19,'gd-small-text');
  }
  function watch(host,pause) {
    const observer=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)pause();},{threshold:.03});
    observer.observe(host);
    const item={host:host,pause:pause,dispose:()=>{pause();observer.disconnect();}};
    active.add(item);return item;
  }
  function renderFormula(target,formula) {
    if(window.katex)window.katex.render('\\displaystyle '+formula,target,{throwOnError:false});
    else target.textContent=formula;
  }

  function setupDescent(host) {
    const id='route-descent-'+(++serial);
    host.dataset.ready='true';
    host.innerHTML='<ol class="gd-phases" aria-label="一次迭代的三个阶段"><li>1 看斜率</li><li>2 走一步</li><li>3 重新求导</li></ol>'
      +'<div class="gd-panels"><div class="gd-panel"><p class="gd-panel-title">路线 A → P → B</p><svg class="gd-route" viewBox="0 0 560 390" role="slider" tabindex="0" aria-label="沿边界拖动进入点P选择起点" aria-valuemin="0" aria-valuemax="8"></svg></div>'
      +'<div class="gd-panel"><p class="gd-panel-title">总耗时 T(x)</p><svg class="gd-time" viewBox="0 0 560 390" role="img" aria-label="耗时曲线、当前位置与切线"></svg>'
      +'<div class="gd-legend"><span style="color:var(--gd-teal)"><i></i>耗时曲线</span><span style="color:var(--gd-rust)"><i class="gd-dashed"></i>当前切线</span></div></div></div>'
      +'<div class="gd-metrics"><div><span>进入点位置 x</span><output class="gd-x"></output></div><div><span>总耗时 T(x)</span><output class="gd-time-value"></output></div><div><span>已完成迭代</span><output class="gd-count"></output></div></div>'
      +'<div class="gd-inputs"><div class="gd-input-row"><label for="'+id+'-initial">起点 P（x₀）</label><input id="'+id+'-initial" type="range" min="0" max="8" step="0.1" value="1.2" aria-label="初始进入点P的横坐标x₀"><output for="'+id+'-initial">1.2</output></div>'
      +'<div class="gd-input-row"><label for="'+id+'-eta">步长 η</label><input id="'+id+'-eta" type="range" min="0.2" max="6" step="0.2" value="2" aria-label="梯度下降步长η"><output for="'+id+'-eta">2.0</output></div></div>'
      +'<div class="gd-actions"><button class="gd-primary gd-single" type="button">单步演示</button><button class="gd-play" type="button">连续迭代</button><button class="gd-reset" type="button">重置</button>'
      +'<label class="gd-reference"><input type="checkbox" aria-label="显示参考最优点">显示参考最优点</label></div>'
      +'<div class="gd-parameters" role="note" aria-label="参数选取"><span>参数选取：</span><span class="gd-parameter"></span><span class="gd-parameter"></span><span class="gd-parameter"></span><span class="gd-parameter"></span><span class="gd-parameter"></span></div>';
    const parameterNames=['h_1','h_2','l','v_1','v_2'];
    const parameterValues=[M.parameters.h1,M.parameters.h2,M.parameters.l,M.parameters.v1,M.parameters.v2];
    host.querySelectorAll('.gd-parameter').forEach((node,i)=>renderFormula(node,parameterNames[i]+'='+parameterValues[i]));
    const route=host.querySelector('.gd-route'),plot=host.querySelector('.gd-time');
    const initialInput=host.querySelector('[id$="-initial"]'),etaInput=host.querySelector('[id$="-eta"]');
    const inputs=host.querySelectorAll('.gd-input-row output'),phases=host.querySelectorAll('.gd-phases li');
    const single=host.querySelector('.gd-single'),play=host.querySelector('.gd-play'),reset=host.querySelector('.gd-reset');
    const reference=host.querySelector('input[type="checkbox"]');
    const outputs=[host.querySelector('.gd-x'),host.querySelector('.gd-time-value'),host.querySelector('.gd-count')];
    const duration=reduced?900:2100,lookEnd=550,moveEnd=reduced?550:1650;
    const s={x:1.2,initial:1.2,eta:2,k:0,history:[1.2],step:null,elapsed:0,phase:-1,auto:false,
      running:false,raf:0,last:0,lastPaint:0,batchEnd:36};
    let dragging=false;
    function isConverged() {return Math.abs(M.derivative(s.x))<.001;}
    function controls() {
      single.disabled=!!s.step||isConverged();
      initialInput.disabled=s.running;etaInput.disabled=s.running;
      route.setAttribute('aria-disabled',s.running?'true':'false');
      play.disabled=isConverged()&&!s.step;
      play.textContent=s.running?'暂停':s.step?'继续迭代':isConverged()?'已接近最优点':'连续迭代';
      play.setAttribute('aria-pressed',s.running?'true':'false');
    }
    function visualX() {
      if(!s.step||s.step.committed)return s.x;
      const t=Math.max(0,Math.min(1,(s.elapsed-lookEnd)/Math.max(1,moveEnd-lookEnd)));
      return mix(s.step.from,s.step.to,reduced?(s.elapsed>=moveEnd?1:0):smooth(t));
    }
    function drawRoute(x) {
      route.replaceChildren();
      const X=x=>60+50*x,Y=y=>210-50*y;
      el(route,'rect',{x:35,y:30,width:490,height:180,fill:'var(--gd-teal)','fill-opacity':'.035'});
      el(route,'rect',{x:35,y:210,width:490,height:155,fill:'var(--gd-teal)','fill-opacity':'.09'});
      arrow(route,35,210,535,210,'gd-axis');
      [0,2,4,6,8].forEach(n=>{line(route,X(n),206,X(n),215,'gd-axis');text(route,n,X(n),239,'gd-small-text');});
      text(route,'x',544,219,'gd-small-text');
      text(route,'结界外 · v₁ = 2',373,57,'gd-small-text');
      text(route,'结界内 · v₂ = 1',151,335,'gd-small-text');
      if(s.step&&!s.step.committed) {
        el(route,'path',{d:'M'+X(0)+','+Y(3)+' L'+X(s.step.from)+',210 L'+X(8)+','+Y(-2),class:'gd-old-route'});
        el(route,'circle',{cx:X(s.step.to),cy:210,r:8,class:'gd-next'});
        if(Math.abs(s.step.to-s.step.from)>.6)text(route,'下一步',X(s.step.to),169,'gd-small-text');
        arrow(route,X(s.step.from),266,X(s.step.to),266,'gd-arrow');
        if(Math.abs(s.step.to-s.step.from)>.3)text(route,'Δx',X((s.step.from+s.step.to)/2),292,'gd-small-text');
      }
      line(route,X(0),Y(3),X(x),210,'gd-route-out');line(route,X(x),210,X(8),Y(-2),'gd-route-in');
      el(route,'circle',{cx:X(0),cy:Y(3),r:6,class:'gd-fixed-point'});
      el(route,'circle',{cx:X(8),cy:Y(-2),r:6,class:'gd-fixed-point'});
      text(route,'A',X(0)-12,Y(3)-15);text(route,'B',X(8)+16,Y(-2)+5);
      text(route,'O',X(0)-18,194,'gd-small-text');text(route,'Q',X(8)+16,194,'gd-small-text');
      if(reference.checked) {
        line(route,X(M.reference.x),210,X(M.reference.x),350,'gd-reference-line');
        el(route,'circle',{cx:X(M.reference.x),cy:210,r:5,class:'gd-reference-point'});
        text(route,'x* ≈ '+fmt(M.reference.x,3),X(M.reference.x),376,'gd-tiny-text');
      }
      el(route,'circle',{cx:X(x),cy:210,r:16,class:'gd-current-ring'});
      el(route,'circle',{cx:X(x),cy:210,r:7,class:'gd-current'});
      text(route,'P',X(x)-13,191);
      el(route,'circle',{cx:X(x),cy:210,r:24,fill:'transparent',class:'gd-point-handle'});
      route.setAttribute('aria-valuenow',fmt(x,3));
      route.setAttribute('aria-valuetext','进入点x约为'+fmt(x,3)+'，总耗时约为'+fmt(M.time(x),3));
    }
    function drawTime(x) {
      plot.replaceChildren();
      const L=67,R=508,T=40,B=310,X=x=>L+x/8*(R-L),Y=t=>B-(t-5.65)/(10.2-5.65)*(B-T);
      axes(plot,L,T,R,B,X,Y,[0,2,4,6,8],[6,7,8,9,10],'x','T');
      const area=clip(plot,id+'-time-clip',L,T,R,B);
      sampledPath(area,M.time,0,8,X,Y,'gd-curve');
      const history=s.history.slice(-9);
      if(history.length>1)el(area,'path',{d:history.map((v,i)=>(i?'L':'M')+X(v)+','+Y(M.time(v))).join(' '),class:'gd-trail'});
      history.forEach(v=>el(area,'circle',{cx:X(v),cy:Y(M.time(v)),r:4,class:'gd-trail-dot'}));
      const anchor=s.step&&!s.step.committed?s.step.from:s.x,gradient=M.derivative(anchor),value=M.time(anchor);
      sampledPath(area,v=>value+gradient*(v-anchor),Math.max(0,anchor-1.2),Math.min(8,anchor+1.2),X,Y,'gd-tangent');
      line(area,X(x),Y(M.time(x)),X(x),B,'gd-guide');
      if(s.step&&!s.step.committed) {
        const to=s.step.to;
        line(area,X(to),Y(M.time(to)),X(to),B,'gd-guide');
        el(area,'circle',{cx:X(to),cy:Y(M.time(to)),r:7,class:'gd-next'});
        if(Math.abs(to-anchor)>.6)text(plot,'下一步',X(to),Math.max(T+23,Y(M.time(to))-21),'gd-small-text');
        const direction=-Math.sign(gradient),end=Math.max(0,Math.min(8,anchor+direction*.8));
        arrow(area,X(anchor),Y(value),X(end),Y(value+gradient*(end-anchor)),'gd-arrow');
      }
      if(reference.checked) {
        line(area,X(M.reference.x),Y(M.reference.time),X(M.reference.x),B,'gd-reference-line');
        el(area,'circle',{cx:X(M.reference.x),cy:Y(M.reference.time),r:5,class:'gd-reference-point'});
        text(plot,'x*',X(M.reference.x),B+50,'gd-small-text');
      }
      el(area,'circle',{cx:X(x),cy:Y(M.time(x)),r:14,class:'gd-current-ring'});
      el(area,'circle',{cx:X(x),cy:Y(M.time(x)),r:7,class:'gd-current'});
      const labelRight=anchor<4;
      const slopeLabel=text(plot,'T′(xₖ) ≈ '+fmt(gradient,4),X(anchor)+(labelRight?16:-16),
        Math.max(T+23,Y(value)-23),'gd-small-text',labelRight?'start':'end');
      slopeLabel.style.fill='var(--gd-rust)';
      plot.setAttribute('aria-label','总耗时曲线上x约为'+fmt(x,3)+'，本步起点斜率约为'+fmt(gradient,4));
    }
    function draw() {
      const x=visualX();drawRoute(x);drawTime(x);
      outputs[0].textContent=fmt(x,3);outputs[1].textContent=fmt(M.time(x),3);outputs[2].textContent=String(s.k);
      host.dataset.iteration=String(s.k);host.dataset.phase=String(s.phase);
      phases.forEach((p,i)=>p.classList.toggle('is-current',i===s.phase));
    }
    function commit() {
      const step=s.step;if(!step||step.committed)return;
      step.committed=true;s.x=step.to;s.history.push(s.x);s.k++;
    }
    function begin() {
      if(isConverged())return false;
      const to=M.next(s.x,s.eta);
      s.step={from:s.x,to:to,committed:false};s.elapsed=0;s.phase=-1;
      return true;
    }
    function pause() {
      if(!s.running)return;
      s.running=false;cancelAnimationFrame(s.raf);s.raf=0;s.last=0;controls();
    }
    function finish() {
      s.step=null;
      if(isConverged()) {
        s.auto=false;
      }
      if(s.auto&&s.k<s.batchEnd&&!isConverged())begin();
      else {
        s.auto=false;pause();
      }
      controls();draw();
    }
    function tick(timestamp) {
      if(!s.running)return;
      if(!host.isConnected||document.hidden){pause();return;}
      if(s.last)s.elapsed+=Math.min(80,timestamp-s.last);
      s.last=timestamp;
      const phase=s.elapsed<lookEnd?0:s.elapsed<moveEnd?1:2;
      if(phase!==s.phase) {
        s.phase=phase;
        if(phase===2)commit();
        draw();
      }
      if(s.elapsed-s.lastPaint>32||s.elapsed<s.lastPaint){s.lastPaint=s.elapsed;draw();}
      if(s.elapsed>=duration){finish();s.last=timestamp;}
      if(s.running)s.raf=requestAnimationFrame(tick);
    }
    function resume() {s.running=true;s.last=0;s.lastPaint=-100;controls();s.raf=requestAnimationFrame(tick);}
    function restart(defaults) {
      pause();
      if(defaults){initialInput.value='1.2';etaInput.value='2';reference.checked=false;}
      s.initial=Number(initialInput.value);s.eta=Number(etaInput.value);s.x=s.initial;
      s.k=0;s.history=[s.x];s.step=null;s.elapsed=0;s.phase=-1;s.auto=false;
      inputs[0].textContent=fmt(s.initial,1);inputs[1].textContent=fmt(s.eta,1);
      controls();draw();
    }
    single.addEventListener('click',()=>{s.auto=false;s.batchEnd=s.k+1;if(begin())resume();});
    play.addEventListener('click',()=>{
      if(s.running){pause();return;}
      s.auto=true;s.batchEnd=s.k+36;
      if(s.step||begin())resume();
    });
    reset.addEventListener('click',()=>restart(true));
    initialInput.addEventListener('input',()=>restart(false));etaInput.addEventListener('input',()=>restart(false));
    reference.addEventListener('change',draw);
    function pointFromEvent(event) {
      const matrix=route.getScreenCTM();if(!matrix)return;
      const p=route.createSVGPoint();p.x=event.clientX;p.y=event.clientY;
      const point=p.matrixTransform(matrix.inverse());
      initialInput.value=String(Math.max(0,Math.min(8,Math.round((point.x-60)/50*10)/10)));restart(false);
    }
    route.addEventListener('pointerdown',event=>{
      if(s.running||event.button!==0||!event.target.closest('.gd-point-handle'))return;
      event.preventDefault();dragging=true;route.setPointerCapture(event.pointerId);
    });
    route.addEventListener('pointermove',event=>{if(dragging)pointFromEvent(event);});
    ['pointerup','pointercancel','lostpointercapture'].forEach(name=>route.addEventListener(name,()=>{dragging=false;}));
    route.addEventListener('keydown',event=>{
      if(s.running)return;
      let value=Number(initialInput.value);
      if(event.key==='Home')value=0;
      else if(event.key==='End')value=8;
      else if(['ArrowLeft','ArrowDown'].includes(event.key))value-=event.shiftKey?1:.1;
      else if(['ArrowRight','ArrowUp'].includes(event.key))value+=event.shiftKey?1:.1;
      else return;
      event.preventDefault();initialInput.value=String(Math.max(0,Math.min(8,value)));restart(false);
    });
    watch(host,pause);restart(true);
  }

  function setupComparison(host) {
    const id='route-comparison-'+(++serial),etas=[.4,2,6],colors=['var(--gd-small)','var(--gd-good)','var(--gd-rust)'];
    const traces=etas.map(eta=>M.trace(1.2,eta,24));
    host.dataset.ready='true';
    host.innerHTML='<div class="gd-heading"><span>同一起点，不同步长</span><small>x₀ = 1.2</small></div>'
      +'<div class="gd-legend"><span style="color:var(--gd-small)"><i></i>η = 0.4</span><span style="color:var(--gd-good)"><i></i>η = 2.0</span><span style="color:var(--gd-rust)"><i></i>η = 6.0</span><span style="color:var(--gd-gold)"><i class="gd-dashed"></i>参考最优</span></div>'
      +'<div class="gd-panels"><div class="gd-panel"><p class="gd-panel-title">进入点的位置 xₖ</p><svg class="gd-comparison-x" viewBox="0 0 560 390" role="img" aria-label="不同步长的进入点位置随迭代次数变化"></svg></div>'
      +'<div class="gd-panel"><p class="gd-panel-title">实际总耗时 T(xₖ)</p><svg class="gd-comparison-time" viewBox="0 0 560 390" role="img" aria-label="不同步长的实际总耗时随迭代次数变化"></svg></div></div>'
      +'<div class="gd-comparison-progress"><label for="'+id+'">迭代次数 k</label><input id="'+id+'" type="range" min="0" max="24" step="1" value="0" aria-label="步长对比的迭代次数k"><output for="'+id+'">0</output></div>'
      +'<div class="gd-actions"><button class="gd-primary gd-compare-play" type="button">播放对比</button><button class="gd-compare-step" type="button">下一步</button><button class="gd-compare-reset" type="button">重置</button></div>'
      +'<table class="gd-comparison-table"><thead><tr><th>步长 η</th><th>进入点 xₖ</th><th>耗时 T(xₖ)</th></tr></thead><tbody>'+etas.map((eta,i)=>'<tr style="color:'+colors[i]+'"><td>'+fmt(eta,1)+'</td><td></td><td></td></tr>').join('')+'</tbody></table>'
      +'<p class="gd-status" role="status" aria-live="polite"></p>';
    const graphs=[host.querySelector('.gd-comparison-x'),host.querySelector('.gd-comparison-time')],input=host.querySelector('input');
    const output=host.querySelector('output'),play=host.querySelector('.gd-compare-play'),step=host.querySelector('.gd-compare-step'),reset=host.querySelector('.gd-compare-reset');
    const rows=host.querySelectorAll('tbody tr'),status=host.querySelector('.gd-status');
    let progress=0,running=false,raf=0,last=0,paint=0;
    function drawGraph(svg,kind) {
      svg.replaceChildren();
      const L=67,R=508,T=40,B=310,low=kind==='x'?0:5.7,high=kind==='x'?8.5:10.2;
      const X=k=>L+k/24*(R-L),Y=value=>B-(value-low)/(high-low)*(B-T);
      axes(svg,L,T,R,B,X,Y,[0,6,12,18,24],kind==='x'?[0,2,4,6,8]:[6,7,8,9,10],'k',kind==='x'?'xₖ':'T');
      const value=kind==='x'?M.reference.x:M.reference.time;
      line(svg,L,Y(value),R,Y(value),'gd-reference-line');
      const area=clip(svg,id+'-'+kind+'-clip',L,T,R,B),n=Math.min(24,Math.floor(progress)),fraction=progress-n;
      traces.forEach((trace,i)=>{
        const path=[];
        for(let k=0;k<=n;k++)path.push((k?'L':'M')+X(k)+','+Y(kind==='x'?trace[k].x:trace[k].time));
        let endX=X(n),endY=Y(kind==='x'?trace[n].x:trace[n].time);
        if(n<24&&fraction>0) {
          endX=X(progress);endY=Y(mix(kind==='x'?trace[n].x:trace[n].time,kind==='x'?trace[n+1].x:trace[n+1].time,fraction));
          path.push('L'+endX+','+endY);
        }
        el(area,'path',{d:path.join(' '),class:'gd-step-path',stroke:colors[i]});
        for(let k=0;k<=n;k++)el(area,'circle',{cx:X(k),cy:Y(kind==='x'?trace[k].x:trace[k].time),r:3.5,fill:colors[i],class:'gd-comparison-point'});
        el(area,'circle',{cx:endX,cy:endY,r:6,fill:colors[i],class:'gd-comparison-point'});
      });
      svg.setAttribute('aria-label',(kind==='x'?'进入点位置':'实际总耗时')+'，显示至第'+n+'次迭代');
    }
    function draw() {
      drawGraph(graphs[0],'x');drawGraph(graphs[1],'time');
      const n=Math.min(24,Math.floor(progress));input.value=String(n);output.textContent=String(n);host.dataset.iteration=String(n);
      traces.forEach((trace,i)=>{rows[i].children[1].textContent=fmt(trace[n].x,3);rows[i].children[2].textContent=fmt(trace[n].time,3);});
      if(n===0)status.textContent='三组从同一个进入点出发，使用同一个耗时函数，只改变步长。';
      else if(n>=24)status.textContent='24 步后：小步仍在靠近；合适的步长已接近最优点；过大步长仍在两侧反复跳动。';
      else status.textContent='正在比较第 '+n+' 步。观察进入点是否稳定，以及总耗时有没有回升。';
      step.disabled=running||n>=24;play.textContent=running?'暂停':n>=24?'重新播放':'播放对比';play.setAttribute('aria-pressed',running?'true':'false');
    }
    function pause() {running=false;cancelAnimationFrame(raf);raf=0;last=0;draw();}
    function tick(t) {
      if(!running)return;
      if(!host.isConnected||document.hidden){pause();return;}
      if(last)progress=Math.min(24,progress+Math.min(80,t-last)/700);
      last=t;
      if(t-paint>32){paint=t;draw();}
      if(progress>=24){pause();return;}
      raf=requestAnimationFrame(tick);
    }
    play.addEventListener('click',()=>{if(running){pause();return;}if(progress>=24)progress=0;running=true;last=0;draw();raf=requestAnimationFrame(tick);});
    step.addEventListener('click',()=>{pause();progress=Math.min(24,Math.floor(progress)+1);draw();});
    reset.addEventListener('click',()=>{pause();progress=0;draw();});
    input.addEventListener('input',()=>{const target=Number(input.value);pause();progress=target;draw();});
    watch(host,pause);draw();
  }
  function init() {
    active.forEach(item=>{if(!item.host.isConnected){item.dispose();active.delete(item);}});
    document.querySelectorAll('.refraction-gradient:not([data-ready])').forEach(setupDescent);
    document.querySelectorAll('.refraction-stability:not([data-ready])').forEach(setupComparison);
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)active.forEach(item=>item.pause());});
  window.addEventListener('beforeprint',()=>active.forEach(item=>item.pause()));
  document.addEventListener('reader:chapter',init);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
