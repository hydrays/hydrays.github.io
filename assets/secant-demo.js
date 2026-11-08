(function () {
  'use strict';
  function init() {
    document.querySelectorAll('.secant-demo:not([data-ready])').forEach(function (root) {
      root.dataset.ready = 'true';
      var svg = root.querySelector('.secant-demo-plot');
      var linearSvg = root.querySelector('.secant-demo-linear-plot');
      var linearQuotient = root.querySelector('.secant-demo-linear-quotient');
      var slider = root.querySelector('input');
      var quotient = root.querySelector('.secant-demo-quotient');
      var deltaXOutput = root.querySelector('output');
      var ns = 'http://www.w3.org/2000/svg';
      var deltaX = Number(slider.value);
      var minDeltaX = Number(slider.min), maxDeltaX = Number(slider.max);
      var xMin = 0, xMax = 2.7, yMin = -0.5, yMax = 6.7;
      function X(x) { return 56+(x-xMin)/(xMax-xMin)*480; }
      function Y(y) { return 365-(y-yMin)/(yMax-yMin)*320; }
      function node(parent, tag, attrs) {
        var el = document.createElementNS(ns,tag);
        Object.keys(attrs || {}).forEach(function (key) {el.setAttribute(key,attrs[key]);});
        parent.appendChild(el);
        return el;
      }
      function text(parent,value,x,y,cls) {
        var el=node(parent,'text',{x:x,y:y});
        if(cls) el.setAttribute('class',cls);
        el.textContent=value;
        return el;
      }
      function line(parent,x1,y1,x2,y2,cls) {
        return node(parent,'line',{x1:x1,y1:y1,x2:x2,y2:y2,'class':cls});
      }
      var defs=node(svg,'defs');
      var clipId=root.id+'-clip';
      var clip=node(defs,'clipPath',{id:clipId});
      node(clip,'rect',{x:56,y:45,width:480,height:320});
      [1,2].forEach(function(x){
        line(svg,X(x),45,X(x),365,'secant-gridline');
        text(svg,String(x),X(x)-6,Y(0)+30);
      });
      [2,4,6].forEach(function(y){
        line(svg,56,Y(y),536,Y(y),'secant-gridline');
        text(svg,String(y),X(0)-30,Y(y)+8);
      });
      line(svg,56,Y(0),536,Y(0),'secant-axis');
      line(svg,X(0),45,X(0),365,'secant-axis');
      text(svg,'0',X(0)-24,Y(0)+30);
      text(svg,'x',546,Y(0)+8); text(svg,'y',X(0)-7,30);
      var plot=node(svg,'g',{'clip-path':'url(#'+clipId+')'});
      var curve=[];
      for(var i=0;i<=240;i++){
        var x=xMin+(xMax-xMin)*i/240;
        curve.push((i?'L':'M')+X(x)+','+Y(x*x));
      }
      node(plot,'path',{d:curve.join(' '),'class':'secant-curve'});
      line(plot,X(xMin),Y(2*xMin-1),X(xMax),Y(2*xMax-1),'secant-tangent');
      var secant=node(plot,'line',{'class':'secant-line'});
      var step=node(plot,'path',{'class':'secant-step'});
      node(svg,'circle',{cx:X(1),cy:Y(1),r:7,'class':'secant-point-p'});
      text(svg,'P',X(1)-28,Y(1)+26);
      var qLabel=text(svg,'Q',0,0);
      var dxLabel=text(svg,'Δx',0,0,'secant-increment-label');
      dxLabel.setAttribute('text-anchor','middle');
      var dyLabel=text(svg,'Δy',0,0,'secant-increment-label');
      var q=node(svg,'circle',{r:24,fill:'transparent',stroke:'none','class':'secant-point-q',tabindex:'0',role:'slider','aria-label':'沿曲线移动点Q，仅显示固定点右侧','aria-valuemin':String(1+minDeltaX),'aria-valuemax':String(1+maxDeltaX)});
      var qDot=node(svg,'circle',{r:7,fill:'var(--secant-line)',stroke:'var(--paper-panel)','stroke-width':2,'pointer-events':'none'});
      var linearState=null;
      if(linearSvg){
        var linearDefs=node(linearSvg,'defs');
        var linearClipId=root.id+'-linear-clip';
        var linearClip=node(linearDefs,'clipPath',{id:linearClipId});
        node(linearClip,'rect',{x:56,y:45,width:480,height:320});
        [1,2].forEach(function(x){
          line(linearSvg,X(x),45,X(x),365,'secant-gridline');
          text(linearSvg,String(x),X(x)-6,Y(0)+30);
        });
        [2,4,6].forEach(function(y){
          line(linearSvg,56,Y(y),536,Y(y),'secant-gridline');
          text(linearSvg,String(y),X(0)-30,Y(y)+8);
        });
        line(linearSvg,56,Y(0),536,Y(0),'secant-axis');
        line(linearSvg,X(0),45,X(0),365,'secant-axis');
        text(linearSvg,'0',X(0)-24,Y(0)+30);
        text(linearSvg,'x',546,Y(0)+8);text(linearSvg,'y',X(0)-7,30);
        var linearPlot=node(linearSvg,'g',{'clip-path':'url(#'+linearClipId+')'});
        line(linearPlot,X(xMin),Y(2*xMin-1),X(xMax),Y(2*xMax-1),'secant-curve');
        var linearSecant=node(linearPlot,'line',{'class':'secant-line'});
        var linearStep=node(linearPlot,'path',{'class':'secant-step'});
        node(linearSvg,'circle',{cx:X(1),cy:Y(1),r:7,'class':'secant-point-p'});
        text(linearSvg,'P',X(1)-28,Y(1)+26);
        var linearQLabel=text(linearSvg,'Q',0,0);
        var linearDxLabel=text(linearSvg,'Δx',0,0,'secant-increment-label');
        linearDxLabel.setAttribute('text-anchor','middle');
        var linearDyLabel=text(linearSvg,'Δy',0,0,'secant-increment-label');
        var linearQ=node(linearSvg,'circle',{r:24,fill:'transparent',stroke:'none','class':'secant-point-q',tabindex:'0',role:'slider','aria-label':'沿直线移动点Q，差商保持为2','aria-valuemin':String(1+minDeltaX),'aria-valuemax':String(1+maxDeltaX)});
        var linearQDot=node(linearSvg,'circle',{r:7,fill:'var(--secant-line)',stroke:'var(--paper-panel)','stroke-width':2,'pointer-events':'none'});
        linearState={q:linearQ,dot:linearQDot,label:linearQLabel,dx:linearDxLabel,dy:linearDyLabel,step:linearStep,secant:linearSecant};
        if(window.katex)window.katex.render('\\displaystyle\\frac{\\Delta y}{\\Delta x}=2',linearQuotient,{throwOnError:false});
        else linearQuotient.textContent='Δy ÷ Δx = 2';
      }
      function format(n){return Number(n.toFixed(3)).toString();}
      function update(next){
        deltaX=Math.round(Math.max(minDeltaX,Math.min(maxDeltaX,next))*1000)/1000;
        var xq=1+deltaX, yq=xq*xq, slope=2+deltaX;
        slider.value=String(deltaX);
        slider.setAttribute('aria-valuetext','Δx = '+format(deltaX));
        deltaXOutput.textContent='Δx = '+format(deltaX);
        q.setAttribute('cx',X(xq));q.setAttribute('cy',Y(yq));
        q.setAttribute('aria-valuenow',format(xq));
        q.setAttribute('aria-valuetext','Q = ('+format(xq)+', '+format(yq)+')，Δx = '+format(deltaX));
        qDot.setAttribute('cx',X(xq));qDot.setAttribute('cy',Y(yq));
        qLabel.setAttribute('x',X(xq)-22);qLabel.setAttribute('y',Y(yq)-17);
        secant.setAttribute('x1',X(xMin));secant.setAttribute('y1',Y(1+slope*(xMin-1)));
        secant.setAttribute('x2',X(xMax));secant.setAttribute('y2',Y(1+slope*(xMax-1)));
        step.setAttribute('d','M'+X(1)+','+Y(1)+' L'+X(xq)+','+Y(1)+' L'+X(xq)+','+Y(yq));
        dxLabel.setAttribute('x',X(1+deltaX/2));dxLabel.setAttribute('y',Y(1)+38);
        dyLabel.setAttribute('x',X(xq)+15);dyLabel.setAttribute('y',Y((1+yq)/2)+8);
        var formula='\\displaystyle\\frac{\\Delta y}{\\Delta x}='+format(slope);
        if(window.katex)window.katex.render(formula,quotient,{throwOnError:false});
        else quotient.textContent='Δy ÷ Δx = '+format(slope);
        if(linearState){
          var linearY=1+2*deltaX;
          linearState.q.setAttribute('cx',X(xq));linearState.q.setAttribute('cy',Y(linearY));
          linearState.q.setAttribute('aria-valuenow',format(xq));
          linearState.q.setAttribute('aria-valuetext','Q = ('+format(xq)+', '+format(linearY)+')，Δx = '+format(deltaX)+'，差商 = 2');
          linearState.dot.setAttribute('cx',X(xq));linearState.dot.setAttribute('cy',Y(linearY));
          linearState.label.setAttribute('x',X(xq)-22);linearState.label.setAttribute('y',Y(linearY)-17);
          linearState.secant.setAttribute('x1',X(1));linearState.secant.setAttribute('y1',Y(1));
          linearState.secant.setAttribute('x2',X(xq));linearState.secant.setAttribute('y2',Y(linearY));
          linearState.step.setAttribute('d','M'+X(1)+','+Y(1)+' L'+X(xq)+','+Y(1)+' L'+X(xq)+','+Y(linearY));
          linearState.dx.setAttribute('x',X(1+deltaX/2));linearState.dx.setAttribute('y',Y(1)+38);
          linearState.dy.setAttribute('x',X(xq)+15);linearState.dy.setAttribute('y',Y(1+deltaX)+8);
        }
      }
      slider.addEventListener('input',function(){update(Number(slider.value));});
      function bindPoint(pointHandle,plotSvg){
        var dragging=false;
        function move(event){
        var matrix=plotSvg.getScreenCTM();
        if(!matrix)return;
        var point=plotSvg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
        point=point.matrixTransform(matrix.inverse());
        update(xMin+(point.x-56)/480*(xMax-xMin)-1);
      }
      pointHandle.addEventListener('pointerdown',function(event){
        if(event.button!==0)return;
        event.preventDefault();dragging=true;pointHandle.setPointerCapture(event.pointerId);
      });
      pointHandle.addEventListener('pointermove',function(event){if(dragging)move(event);});
      function stop(){dragging=false;}
      pointHandle.addEventListener('pointerup',stop);pointHandle.addEventListener('pointercancel',stop);pointHandle.addEventListener('lostpointercapture',stop);
      pointHandle.addEventListener('keydown',function(event){
        var next=deltaX;
        if(event.key==='ArrowLeft'||event.key==='ArrowDown')next-=event.shiftKey?0.1:0.01;
        else if(event.key==='ArrowRight'||event.key==='ArrowUp')next+=event.shiftKey?0.1:0.01;
        else if(event.key==='Home')next=minDeltaX;
        else if(event.key==='End')next=maxDeltaX;
        else return;
        event.preventDefault();update(next);
      });
      }
      bindPoint(q,svg);
      if(linearState)bindPoint(linearState.q,linearSvg);
      update(deltaX);
    });
  }
  document.addEventListener('reader:chapter',init);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();

/* The same curve at a fixed macroscopic scale and a linked local scale. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var L = 98, R = 522, T = 36, B = 330;
  function node(parent, tag, attrs, value) {
    var el = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (key) { el.setAttribute(key, attrs[key]); });
    if (value !== undefined) el.textContent = value;
    parent.appendChild(el);
    return el;
  }
  function line(parent, x1, y1, x2, y2, cls) {
    return node(parent, 'line', {x1:x1, y1:y1, x2:x2, y2:y2, 'class':cls});
  }
  function label(parent, value, x, y, anchor, cls) {
    return node(parent, 'text', {x:x, y:y, 'text-anchor':anchor || 'middle', 'class':cls || ''}, value);
  }
  function format(value, digits) {
    return Number(value.toFixed(digits === undefined ? 6 : digits)).toString();
  }
  function ticks(lo, hi) {
    var raw = (hi-lo)/4;
    var power = Math.pow(10, Math.floor(Math.log10(raw)));
    var ratio = raw/power;
    var step = (ratio<=1 ? 1 : ratio<=2 ? 2 : ratio<=5 ? 5 : 10)*power;
    var first = Math.ceil((lo-step*1e-8)/step)*step;
    var digits = Math.max(0, -Math.floor(Math.log10(step)));
    var out = [];
    for (var value=first; value<=hi+step*1e-8; value+=step) {
      out.push({value:value, text:format(value, digits)});
    }
    return out;
  }
  function curve(parent, fn, lo, hi, X, Y, cls) {
    var points = [];
    for (var i=0; i<=180; i++) {
      var x = lo+(hi-lo)*i/180;
      points.push((i?'L':'M')+X(x).toFixed(3)+','+Y(fn(x)).toFixed(3));
    }
    return node(parent, 'path', {d:points.join(' '), 'class':cls});
  }
  function draw(svg, bounds, local, dx, id, selection) {
    svg.replaceChildren();
    var X = function (x) {return L+(x-bounds.xmin)/(bounds.xmax-bounds.xmin)*(R-L);};
    var Y = function (y) {return B-(y-bounds.ymin)/(bounds.ymax-bounds.ymin)*(B-T);};
    ['xmin','xmax','ymin','ymax'].forEach(function (key) {
      svg.setAttribute('data-'+key, format(bounds[key], 9));
    });
    var defs = node(svg, 'defs');
    var clip = node(defs, 'clipPath', {id:id});
    node(clip, 'rect', {x:L, y:T, width:R-L, height:B-T});
    var xTicks = local ? ticks(bounds.xmin, bounds.xmax) :
      [0,0.5,1,1.5,2].map(function (x) {return {value:x,text:String(x)};});
    var yTicks = local ? ticks(bounds.ymin, bounds.ymax) :
      [0,1,2,3,4,5].map(function (y) {return {value:y,text:String(y)};});
    var axisY = local ? B : Y(0);
    xTicks.forEach(function (tick) {
      var x = X(tick.value);
      line(svg,x,T,x,B,'zoom-grid');
      line(svg,x,axisY-5,x,axisY+5,'zoom-tick');
      label(svg,tick.text,x,axisY+29);
    });
    yTicks.forEach(function (tick) {
      var y = Y(tick.value);
      line(svg,L,y,R,y,'zoom-grid');
      line(svg,L-5,y,L+5,y,'zoom-tick');
      if (local || tick.value!==0) label(svg,tick.text,L-13,y+8,'end');
    });
    line(svg,L,axisY,R+8,axisY,'zoom-axis');
    line(svg,L,B,L,T-10,'zoom-axis');
    node(svg,'path',{d:'M'+(R+1)+' '+(axisY-4)+' L'+(R+8)+' '+axisY+' L'+(R+1)+' '+(axisY+4)+' M'+(L-4)+' '+(T-3)+' L'+L+' '+(T-10)+' L'+(L+4)+' '+(T-3),'class':'zoom-axis'});
    label(svg,'x',R+19,axisY+9);
    label(svg,'y',L,T-19);
    var plot = node(svg,'g',{'clip-path':'url(#'+id+')'});
    if (selection) {
      node(plot,'rect',{x:X(selection.xmin),y:Y(selection.ymax),width:X(selection.xmax)-X(selection.xmin),height:Y(selection.ymin)-Y(selection.ymax),'class':'zoom-selection'});
    }
    curve(plot,function (x) {return 2*x-1;},bounds.xmin,bounds.xmax,X,Y,'zoom-tangent');
    curve(plot,function (x) {return x*x;},bounds.xmin,bounds.xmax,X,Y,'zoom-curve');
    var qx=1+dx, qy=qx*qx;
    if (local) {
      node(plot,'path',{d:'M'+X(1)+' '+Y(1)+' H'+X(qx)+' V'+Y(qy),'class':'zoom-guide'});
      label(svg,'Δx',X(1+dx/2),Y(1)+28,'middle','zoom-delta');
    }
    node(plot,'circle',{cx:X(1),cy:Y(1),r:6,'class':'zoom-p'});
    node(plot,'circle',{cx:X(qx),cy:Y(qy),r:6,'class':'zoom-q'});
    label(svg,'P',X(1)-16,Y(1)+25);
    label(svg,'Q',X(qx)+14,Y(qy)-12);
    svg.setAttribute('aria-label',(local?'微观世界，放大固定点附近':'宏观世界，虚线框标出右图范围')+'；Δx = '+format(dx,3)+'，P = (1, 1)，Q = ('+format(qx)+', '+format(qy)+')');
  }
  function init() {
    document.querySelectorAll('.local-zoom:not([data-ready])').forEach(function (root) {
      root.dataset.ready='true';
      var input=root.querySelector('input');
      var output=root.querySelector('output');
      var macro=root.querySelector('.local-zoom-macro');
      var micro=root.querySelector('.local-zoom-micro');
      function update() {
        var dx=Math.max(Number(input.min),Math.min(Number(input.max),Number(input.value)));
        output.textContent='Δx = '+format(dx,3);
        input.setAttribute('aria-valuetext',output.textContent);
        var xmin=1-dx/4, xmax=1+1.25*dx;
        var pad=.18*(2*dx+dx*dx);
        var local={xmin:xmin,xmax:xmax,ymin:2*xmin-1-pad,ymax:xmax*xmax+pad};
        draw(macro,{xmin:0,xmax:2.2,ymin:-.35,ymax:5},false,dx,root.id+'-macro-clip',local);
        draw(micro,local,true,dx,root.id+'-micro-clip',null);
      }
      input.addEventListener('input',update);
      update();
    });
  }
  document.addEventListener('reader:chapter',init);
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
