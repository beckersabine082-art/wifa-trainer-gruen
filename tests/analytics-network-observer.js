// Test-only observer. Original transports remain active and requests go to Google.
(function () {
  const record = (kind,url,body,result) => {
    const entry = {kind,url:String(url),body:'',result,phase:parent.analyticsTestPhase,time:Date.now()};
    parent.analyticsTestNetwork.push(entry);
    if (body instanceof Blob) body.text().then(text=>entry.body=text);
    else entry.body=body == null ? '' : String(body);
  };
  const beacon = navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon = function(url,body) {
    const result = beacon(url,body); record('beacon',url,body,result); return result;
  };
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = async function(input,options) {
    const url=typeof input==='string'?input:input.url;
    record('fetch',url,options?.body,'started');
    return fetchOriginal(input,options);
  };
  const open=XMLHttpRequest.prototype.open, send=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open=function(method,url,...rest) {this.testUrl=url;return open.call(this,method,url,...rest);};
  XMLHttpRequest.prototype.send=function(body) {record('xhr',this.testUrl,body,'started');return send.call(this,body);};
  new PerformanceObserver(list=>list.getEntries().forEach(entry=>record('resource',entry.name,'',entry.responseStatus))).observe({type:'resource',buffered:true});
}());
