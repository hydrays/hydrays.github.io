/* The route and every animation use this same exact time function. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RefractionGradientModel = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const parameters = Object.freeze({h1:3, h2:2, l:8, v1:2, v2:1});
  function time(x) {
    return Math.hypot(parameters.h1,x)/parameters.v1
      +Math.hypot(parameters.h2,parameters.l-x)/parameters.v2;
  }
  function derivative(x) {
    return x/(parameters.v1*Math.hypot(parameters.h1,x))
      -(parameters.l-x)/(parameters.v2*Math.hypot(parameters.h2,parameters.l-x));
  }
  function secondDerivative(x) {
    return parameters.h1**2/(parameters.v1*Math.hypot(parameters.h1,x)**3)
      +parameters.h2**2/(parameters.v2*Math.hypot(parameters.h2,parameters.l-x)**3);
  }
  function next(x, eta) { return x-eta*derivative(x); }
  function trace(initial, eta, steps) {
    const result=[{x:initial,time:time(initial),derivative:derivative(initial)}];
    for(let k=0;k<steps;k++) {
      const x=next(result[k].x,eta);
      result.push({x:x,time:time(x),derivative:derivative(x)});
    }
    return result;
  }
  /* A reference answer for the optional marker, never used by the iteration. */
  function referenceMinimum() {
    let lo=0,hi=parameters.l;
    for(let i=0;i<80;i++) {
      const middle=(lo+hi)/2;
      if(derivative(middle)>0)hi=middle;else lo=middle;
    }
    const x=(lo+hi)/2;
    return Object.freeze({x:x,time:time(x)});
  }
  return Object.freeze({parameters:parameters,time:time,derivative:derivative,
    secondDerivative:secondDerivative,next:next,trace:trace,reference:referenceMinimum()});
});
