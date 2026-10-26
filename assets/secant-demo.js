(function () {
  'use strict';
  function init() {
    document.querySelectorAll('.secant-demo:not([data-ready])').forEach(function (root) {
      root.dataset.ready = 'true';
      var svg = root.querySelector('.secant-demo-plot');
      var ratioSvg = root.querySelector('.secant-demo-ratio-plot');
      var slider = root.querySelector('input');
      var quotient = root.querySelector('.secant-demo-quotient');
      var hOutput = root.querySelector('output');
      var ns = 'http://www.w3.org/2000/svg';
      var h = Number(slider.value);
      var minH = Number(slider.min), maxH = Number(slider.max);
      var xMin = 0, xMax = 2.7, yMin = -0.5, yMax = 6.7;
      function X(x) { return 56+(x-xMin)/(xMax-xMin)*480; }
      function Y(y) { return 365-(y-yMin)/(yMax-yMin)*320; }
      function RX(x) { return 68+x/1.5*462; }
      function RY(y) { return 365-(y-1.8)/1.8*300; }
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
      var q=node(svg,'circle',{r:24,fill:'transparent',stroke:'none','class':'secant-point-q',tabindex:'0',role:'slider','aria-label':'沿曲线移动点Q，仅显示固定点右侧','aria-valuemin':String(1+minH),'aria-valuemax':String(1+maxH)});
      var qDot=node(svg,'circle',{r:7,fill:'var(--secant-line)',stroke:'var(--paper-panel)','stroke-width':2,'pointer-events':'none'});
      [2,2.5,3,3.5].forEach(function(y){
        line(ratioSvg,68,RY(y),530,RY(y),'secant-gridline');
        text(ratioSvg,String(y),RX(0)-45,RY(y)+8);
      });
      [0.5,1].forEach(function(x){
        line(ratioSvg,RX(x),65,RX(x),365,'secant-gridline');
        text(ratioSvg,String(x),RX(x)-15,397);
      });
      line(ratioSvg,68,365,530,365,'secant-axis');
      line(ratioSvg,68,65,68,365,'secant-axis');
      text(ratioSvg,'0',RX(0)-7,397);
      text(ratioSvg,'Δx',535,397);
      line(ratioSvg,RX(0),RY(2),RX(maxH),RY(2),'secant-tangent');
      line(ratioSvg,RX(0),RY(2),RX(maxH),RY(2+maxH),'secant-line');
      node(ratioSvg,'circle',{cx:RX(0),cy:RY(2),r:6,fill:'var(--paper-panel)',stroke:'var(--secant-line)','stroke-width':2});
      var ratioGuide=node(ratioSvg,'path',{'class':'secant-step'});
      var ratioPoint=node(ratioSvg,'circle',{r:8,fill:'var(--secant-line)'});
      function format(n){return Number(n.toFixed(3)).toString();}
      function update(next){
        h=Math.round(Math.max(minH,Math.min(maxH,next))*1000)/1000;
        var xq=1+h, yq=xq*xq, slope=2+h;
        slider.value=String(h);
        slider.setAttribute('aria-valuetext','Δx = h = '+format(h));
        hOutput.textContent='Δx = h = '+format(h);
        q.setAttribute('cx',X(xq));q.setAttribute('cy',Y(yq));
        q.setAttribute('aria-valuenow',format(xq));
        q.setAttribute('aria-valuetext','Q = ('+format(xq)+', '+format(yq)+')，Δx = '+format(h));
        qDot.setAttribute('cx',X(xq));qDot.setAttribute('cy',Y(yq));
        qLabel.setAttribute('x',X(xq)-22);qLabel.setAttribute('y',Y(yq)-17);
        secant.setAttribute('x1',X(xMin));secant.setAttribute('y1',Y(1+slope*(xMin-1)));
        secant.setAttribute('x2',X(xMax));secant.setAttribute('y2',Y(1+slope*(xMax-1)));
        step.setAttribute('d','M'+X(1)+','+Y(1)+' L'+X(xq)+','+Y(1)+' L'+X(xq)+','+Y(yq));
        dxLabel.setAttribute('x',X(1+h/2));dxLabel.setAttribute('y',Y(1)+38);
        dyLabel.setAttribute('x',X(xq)+15);dyLabel.setAttribute('y',Y((1+yq)/2)+8);
        ratioPoint.setAttribute('cx',RX(h));ratioPoint.setAttribute('cy',RY(slope));
        ratioGuide.setAttribute('d','M'+RX(h)+','+365+' V'+RY(slope)+' H'+RX(0));
        ratioSvg.setAttribute('aria-label','Δx = '+format(h)+' 时，差商为 '+format(slope)+'；当增量趋近零时，差商趋近2');
        var formula='\\displaystyle\\frac{\\Delta y}{\\Delta x}='+format(slope);
        if(window.katex)window.katex.render(formula,quotient,{throwOnError:false});
        else quotient.textContent='Δy ÷ Δx = '+format(slope);
      }
      slider.addEventListener('input',function(){update(Number(slider.value));});
      var dragging=false;
      function move(event){
        var matrix=svg.getScreenCTM();
        if(!matrix)return;
        var point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
        point=point.matrixTransform(matrix.inverse());
        update(xMin+(point.x-56)/480*(xMax-xMin)-1);
      }
      q.addEventListener('pointerdown',function(event){
        if(event.button!==0)return;
        event.preventDefault();dragging=true;q.setPointerCapture(event.pointerId);
      });
      q.addEventListener('pointermove',function(event){if(dragging)move(event);});
      function stop(){dragging=false;}
      q.addEventListener('pointerup',stop);q.addEventListener('pointercancel',stop);q.addEventListener('lostpointercapture',stop);
      q.addEventListener('keydown',function(event){
        var next=h;
        if(event.key==='ArrowLeft'||event.key==='ArrowDown')next-=event.shiftKey?0.1:0.01;
        else if(event.key==='ArrowRight'||event.key==='ArrowUp')next+=event.shiftKey?0.1:0.01;
        else if(event.key==='Home')next=minH;
        else if(event.key==='End')next=maxH;
        else return;
        event.preventDefault();update(next);
      });
      update(h);
    });
  }
  document.addEventListener('reader:chapter',init);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
