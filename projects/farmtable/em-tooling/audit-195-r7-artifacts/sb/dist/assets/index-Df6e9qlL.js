var Tf=Object.defineProperty;var Cf=(e,t,i)=>t in e?Tf(e,t,{enumerable:!0,configurable:!0,writable:!0,value:i}):e[t]=i;var he=(e,t,i)=>Cf(e,typeof t!="symbol"?t+"":t,i);(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))s(r);new MutationObserver(r=>{for(const n of r)if(n.type==="childList")for(const o of n.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&s(o)}).observe(document,{childList:!0,subtree:!0});function i(r){const n={};return r.integrity&&(n.integrity=r.integrity),r.referrerPolicy&&(n.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?n.credentials="include":r.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function s(r){if(r.ep)return;r.ep=!0;const n=i(r);fetch(r.href,n)}})();var Tl="";function Cl(e){Tl=e}function Sf(e=""){if(!Tl){const t=[...document.getElementsByTagName("script")],i=t.find(s=>s.hasAttribute("data-shoelace"));if(i)Cl(i.getAttribute("data-shoelace"));else{const s=t.find(n=>/shoelace(\.min)?\.js($|\?)/.test(n.src)||/shoelace-autoloader(\.min)?\.js($|\?)/.test(n.src));let r="";s&&(r=s.getAttribute("src")),Cl(r.split("/").slice(0,-1).join("/"))}}return Tl.replace(/\/$/,"")+(e?`/${e.replace(/^\//,"")}`:"")}var zh=Object.defineProperty,Of=Object.defineProperties,Af=Object.getOwnPropertyDescriptor,If=Object.getOwnPropertyDescriptors,Fc=Object.getOwnPropertySymbols,Rf=Object.prototype.hasOwnProperty,$f=Object.prototype.propertyIsEnumerable,_o=(e,t)=>(t=Symbol[e])?t:Symbol.for("Symbol."+e),Vl=e=>{throw TypeError(e)},zc=(e,t,i)=>t in e?zh(e,t,{enumerable:!0,configurable:!0,writable:!0,value:i}):e[t]=i,qi=(e,t)=>{for(var i in t||(t={}))Rf.call(t,i)&&zc(e,i,t[i]);if(Fc)for(var i of Fc(t))$f.call(t,i)&&zc(e,i,t[i]);return e},qr=(e,t)=>Of(e,If(t)),E=(e,t,i,s)=>{for(var r=s>1?void 0:s?Af(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&zh(t,i,r),r},Bh=(e,t,i)=>t.has(e)||Vl("Cannot "+i),Df=(e,t,i)=>(Bh(e,t,"read from private field"),t.get(e)),Nf=(e,t,i)=>t.has(e)?Vl("Cannot add the same private member more than once"):t instanceof WeakSet?t.add(e):t.set(e,i),Lf=(e,t,i,s)=>(Bh(e,t,"write to private field"),t.set(e,i),i),Pf=function(e,t){this[0]=e,this[1]=t},Mf=e=>{var t=e[_o("asyncIterator")],i=!1,s,r={};return t==null?(t=e[_o("iterator")](),s=n=>r[n]=o=>t[n](o)):(t=t.call(e),s=n=>r[n]=o=>{if(i){if(i=!1,n==="throw")throw o;return o}return i=!0,{done:!1,value:new Pf(new Promise(a=>{var c=t[n](o);c instanceof Object||Vl("Object expected"),a(c)}),1)}}),r[_o("iterator")]=()=>r,s("next"),"throw"in t?s("throw"):r.throw=n=>{throw n},"return"in t&&s("return"),r};/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const wn=globalThis,jl=wn.ShadowRoot&&(wn.ShadyCSS===void 0||wn.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Gl=Symbol(),Bc=new WeakMap;let Uh=class{constructor(t,i,s){if(this._$cssResult$=!0,s!==Gl)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=i}get styleSheet(){let t=this.o;const i=this.t;if(jl&&t===void 0){const s=i!==void 0&&i.length===1;s&&(t=Bc.get(i)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),s&&Bc.set(i,t))}return t}toString(){return this.cssText}};const Ff=e=>new Uh(typeof e=="string"?e:e+"",void 0,Gl),ee=(e,...t)=>{const i=e.length===1?e[0]:t.reduce((s,r,n)=>s+(o=>{if(o._$cssResult$===!0)return o.cssText;if(typeof o=="number")return o;throw Error("Value passed to 'css' function must be a 'css' function result: "+o+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(r)+e[n+1],e[0]);return new Uh(i,e,Gl)},zf=(e,t)=>{if(jl)e.adoptedStyleSheets=t.map(i=>i instanceof CSSStyleSheet?i:i.styleSheet);else for(const i of t){const s=document.createElement("style"),r=wn.litNonce;r!==void 0&&s.setAttribute("nonce",r),s.textContent=i.cssText,e.appendChild(s)}},Uc=jl?e=>e:e=>e instanceof CSSStyleSheet?(t=>{let i="";for(const s of t.cssRules)i+=s.cssText;return Ff(i)})(e):e;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:Bf,defineProperty:Uf,getOwnPropertyDescriptor:qf,getOwnPropertyNames:Hf,getOwnPropertySymbols:Vf,getPrototypeOf:jf}=Object,Zi=globalThis,qc=Zi.trustedTypes,Gf=qc?qc.emptyScript:"",ko=Zi.reactiveElementPolyfillSupport,Or=(e,t)=>e,Ks={toAttribute(e,t){switch(t){case Boolean:e=e?Gf:null;break;case Object:case Array:e=e==null?e:JSON.stringify(e)}return e},fromAttribute(e,t){let i=e;switch(t){case Boolean:i=e!==null;break;case Number:i=e===null?null:Number(e);break;case Object:case Array:try{i=JSON.parse(e)}catch{i=null}}return i}},Wl=(e,t)=>!Bf(e,t),Hc={attribute:!0,type:String,converter:Ks,reflect:!1,useDefault:!1,hasChanged:Wl};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),Zi.litPropertyMetadata??(Zi.litPropertyMetadata=new WeakMap);let Vs=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??(this.l=[])).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,i=Hc){if(i.state&&(i.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((i=Object.create(i)).wrapped=!0),this.elementProperties.set(t,i),!i.noAccessor){const s=Symbol(),r=this.getPropertyDescriptor(t,s,i);r!==void 0&&Uf(this.prototype,t,r)}}static getPropertyDescriptor(t,i,s){const{get:r,set:n}=qf(this.prototype,t)??{get(){return this[i]},set(o){this[i]=o}};return{get:r,set(o){const a=r==null?void 0:r.call(this);n==null||n.call(this,o),this.requestUpdate(t,a,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??Hc}static _$Ei(){if(this.hasOwnProperty(Or("elementProperties")))return;const t=jf(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(Or("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(Or("properties"))){const i=this.properties,s=[...Hf(i),...Vf(i)];for(const r of s)this.createProperty(r,i[r])}const t=this[Symbol.metadata];if(t!==null){const i=litPropertyMetadata.get(t);if(i!==void 0)for(const[s,r]of i)this.elementProperties.set(s,r)}this._$Eh=new Map;for(const[i,s]of this.elementProperties){const r=this._$Eu(i,s);r!==void 0&&this._$Eh.set(r,i)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const i=[];if(Array.isArray(t)){const s=new Set(t.flat(1/0).reverse());for(const r of s)i.unshift(Uc(r))}else t!==void 0&&i.push(Uc(t));return i}static _$Eu(t,i){const s=i.attribute;return s===!1?void 0:typeof s=="string"?s:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var t;this._$ES=new Promise(i=>this.enableUpdating=i),this._$AL=new Map,this._$E_(),this.requestUpdate(),(t=this.constructor.l)==null||t.forEach(i=>i(this))}addController(t){var i;(this._$EO??(this._$EO=new Set)).add(t),this.renderRoot!==void 0&&this.isConnected&&((i=t.hostConnected)==null||i.call(t))}removeController(t){var i;(i=this._$EO)==null||i.delete(t)}_$E_(){const t=new Map,i=this.constructor.elementProperties;for(const s of i.keys())this.hasOwnProperty(s)&&(t.set(s,this[s]),delete this[s]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return zf(t,this.constructor.elementStyles),t}connectedCallback(){var t;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(t=this._$EO)==null||t.forEach(i=>{var s;return(s=i.hostConnected)==null?void 0:s.call(i)})}enableUpdating(t){}disconnectedCallback(){var t;(t=this._$EO)==null||t.forEach(i=>{var s;return(s=i.hostDisconnected)==null?void 0:s.call(i)})}attributeChangedCallback(t,i,s){this._$AK(t,s)}_$ET(t,i){var n;const s=this.constructor.elementProperties.get(t),r=this.constructor._$Eu(t,s);if(r!==void 0&&s.reflect===!0){const o=(((n=s.converter)==null?void 0:n.toAttribute)!==void 0?s.converter:Ks).toAttribute(i,s.type);this._$Em=t,o==null?this.removeAttribute(r):this.setAttribute(r,o),this._$Em=null}}_$AK(t,i){var n,o;const s=this.constructor,r=s._$Eh.get(t);if(r!==void 0&&this._$Em!==r){const a=s.getPropertyOptions(r),c=typeof a.converter=="function"?{fromAttribute:a.converter}:((n=a.converter)==null?void 0:n.fromAttribute)!==void 0?a.converter:Ks;this._$Em=r;const d=c.fromAttribute(i,a.type);this[r]=d??((o=this._$Ej)==null?void 0:o.get(r))??d,this._$Em=null}}requestUpdate(t,i,s,r=!1,n){var o;if(t!==void 0){const a=this.constructor;if(r===!1&&(n=this[t]),s??(s=a.getPropertyOptions(t)),!((s.hasChanged??Wl)(n,i)||s.useDefault&&s.reflect&&n===((o=this._$Ej)==null?void 0:o.get(t))&&!this.hasAttribute(a._$Eu(t,s))))return;this.C(t,i,s)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,i,{useDefault:s,reflect:r,wrapped:n},o){s&&!(this._$Ej??(this._$Ej=new Map)).has(t)&&(this._$Ej.set(t,o??i??this[t]),n!==!0||o!==void 0)||(this._$AL.has(t)||(this.hasUpdated||s||(i=void 0),this._$AL.set(t,i)),r===!0&&this._$Em!==t&&(this._$Eq??(this._$Eq=new Set)).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(i){Promise.reject(i)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var s;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[n,o]of this._$Ep)this[n]=o;this._$Ep=void 0}const r=this.constructor.elementProperties;if(r.size>0)for(const[n,o]of r){const{wrapped:a}=o,c=this[n];a!==!0||this._$AL.has(n)||c===void 0||this.C(n,void 0,o,c)}}let t=!1;const i=this._$AL;try{t=this.shouldUpdate(i),t?(this.willUpdate(i),(s=this._$EO)==null||s.forEach(r=>{var n;return(n=r.hostUpdate)==null?void 0:n.call(r)}),this.update(i)):this._$EM()}catch(r){throw t=!1,this._$EM(),r}t&&this._$AE(i)}willUpdate(t){}_$AE(t){var i;(i=this._$EO)==null||i.forEach(s=>{var r;return(r=s.hostUpdated)==null?void 0:r.call(s)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&(this._$Eq=this._$Eq.forEach(i=>this._$ET(i,this[i]))),this._$EM()}updated(t){}firstUpdated(t){}};Vs.elementStyles=[],Vs.shadowRootOptions={mode:"open"},Vs[Or("elementProperties")]=new Map,Vs[Or("finalized")]=new Map,ko==null||ko({ReactiveElement:Vs}),(Zi.reactiveElementVersions??(Zi.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ar=globalThis,Vc=e=>e,Cn=Ar.trustedTypes,jc=Cn?Cn.createPolicy("lit-html",{createHTML:e=>e}):void 0,qh="$lit$",Ki=`lit$${Math.random().toFixed(9).slice(2)}$`,Hh="?"+Ki,Wf=`<${Hh}>`,_s=document,Lr=()=>_s.createComment(""),Pr=e=>e===null||typeof e!="object"&&typeof e!="function",Yl=Array.isArray,Yf=e=>Yl(e)||typeof(e==null?void 0:e[Symbol.iterator])=="function",Eo=`[ 	
\f\r]`,pr=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Gc=/-->/g,Wc=/>/g,ps=RegExp(`>|${Eo}(?:([^\\s"'>=/]+)(${Eo}*=${Eo}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Yc=/'/g,Kc=/"/g,Vh=/^(?:script|style|textarea|title)$/i,jh=e=>(t,...i)=>({_$litType$:e,strings:t,values:i}),T=jh(1),Ji=jh(2),Wt=Symbol.for("lit-noChange"),Z=Symbol.for("lit-nothing"),Xc=new WeakMap,vs=_s.createTreeWalker(_s,129);function Gh(e,t){if(!Yl(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return jc!==void 0?jc.createHTML(t):t}const Kf=(e,t)=>{const i=e.length-1,s=[];let r,n=t===2?"<svg>":t===3?"<math>":"",o=pr;for(let a=0;a<i;a++){const c=e[a];let d,l,u=-1,p=0;for(;p<c.length&&(o.lastIndex=p,l=o.exec(c),l!==null);)p=o.lastIndex,o===pr?l[1]==="!--"?o=Gc:l[1]!==void 0?o=Wc:l[2]!==void 0?(Vh.test(l[2])&&(r=RegExp("</"+l[2],"g")),o=ps):l[3]!==void 0&&(o=ps):o===ps?l[0]===">"?(o=r??pr,u=-1):l[1]===void 0?u=-2:(u=o.lastIndex-l[2].length,d=l[1],o=l[3]===void 0?ps:l[3]==='"'?Kc:Yc):o===Kc||o===Yc?o=ps:o===Gc||o===Wc?o=pr:(o=ps,r=void 0);const h=o===ps&&e[a+1].startsWith("/>")?" ":"";n+=o===pr?c+Wf:u>=0?(s.push(d),c.slice(0,u)+qh+c.slice(u)+Ki+h):c+Ki+(u===-2?a:h)}return[Gh(e,n+(e[i]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),s]};class Mr{constructor({strings:t,_$litType$:i},s){let r;this.parts=[];let n=0,o=0;const a=t.length-1,c=this.parts,[d,l]=Kf(t,i);if(this.el=Mr.createElement(d,s),vs.currentNode=this.el.content,i===2||i===3){const u=this.el.content.firstChild;u.replaceWith(...u.childNodes)}for(;(r=vs.nextNode())!==null&&c.length<a;){if(r.nodeType===1){if(r.hasAttributes())for(const u of r.getAttributeNames())if(u.endsWith(qh)){const p=l[o++],h=r.getAttribute(u).split(Ki),g=/([.?@])?(.*)/.exec(p);c.push({type:1,index:n,name:g[2],strings:h,ctor:g[1]==="."?Jf:g[1]==="?"?Zf:g[1]==="@"?Qf:jn}),r.removeAttribute(u)}else u.startsWith(Ki)&&(c.push({type:6,index:n}),r.removeAttribute(u));if(Vh.test(r.tagName)){const u=r.textContent.split(Ki),p=u.length-1;if(p>0){r.textContent=Cn?Cn.emptyScript:"";for(let h=0;h<p;h++)r.append(u[h],Lr()),vs.nextNode(),c.push({type:2,index:++n});r.append(u[p],Lr())}}}else if(r.nodeType===8)if(r.data===Hh)c.push({type:2,index:n});else{let u=-1;for(;(u=r.data.indexOf(Ki,u+1))!==-1;)c.push({type:7,index:n}),u+=Ki.length-1}n++}}static createElement(t,i){const s=_s.createElement("template");return s.innerHTML=t,s}}function Xs(e,t,i=e,s){var o,a;if(t===Wt)return t;let r=s!==void 0?(o=i._$Co)==null?void 0:o[s]:i._$Cl;const n=Pr(t)?void 0:t._$litDirective$;return(r==null?void 0:r.constructor)!==n&&((a=r==null?void 0:r._$AO)==null||a.call(r,!1),n===void 0?r=void 0:(r=new n(e),r._$AT(e,i,s)),s!==void 0?(i._$Co??(i._$Co=[]))[s]=r:i._$Cl=r),r!==void 0&&(t=Xs(e,r._$AS(e,t.values),r,s)),t}class Xf{constructor(t,i){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=i}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:i},parts:s}=this._$AD,r=((t==null?void 0:t.creationScope)??_s).importNode(i,!0);vs.currentNode=r;let n=vs.nextNode(),o=0,a=0,c=s[0];for(;c!==void 0;){if(o===c.index){let d;c.type===2?d=new Hr(n,n.nextSibling,this,t):c.type===1?d=new c.ctor(n,c.name,c.strings,this,t):c.type===6&&(d=new em(n,this,t)),this._$AV.push(d),c=s[++a]}o!==(c==null?void 0:c.index)&&(n=vs.nextNode(),o++)}return vs.currentNode=_s,r}p(t){let i=0;for(const s of this._$AV)s!==void 0&&(s.strings!==void 0?(s._$AI(t,s,i),i+=s.strings.length-2):s._$AI(t[i])),i++}}class Hr{get _$AU(){var t;return((t=this._$AM)==null?void 0:t._$AU)??this._$Cv}constructor(t,i,s,r){this.type=2,this._$AH=Z,this._$AN=void 0,this._$AA=t,this._$AB=i,this._$AM=s,this.options=r,this._$Cv=(r==null?void 0:r.isConnected)??!0}get parentNode(){let t=this._$AA.parentNode;const i=this._$AM;return i!==void 0&&(t==null?void 0:t.nodeType)===11&&(t=i.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,i=this){t=Xs(this,t,i),Pr(t)?t===Z||t==null||t===""?(this._$AH!==Z&&this._$AR(),this._$AH=Z):t!==this._$AH&&t!==Wt&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):Yf(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==Z&&Pr(this._$AH)?this._$AA.nextSibling.data=t:this.T(_s.createTextNode(t)),this._$AH=t}$(t){var n;const{values:i,_$litType$:s}=t,r=typeof s=="number"?this._$AC(t):(s.el===void 0&&(s.el=Mr.createElement(Gh(s.h,s.h[0]),this.options)),s);if(((n=this._$AH)==null?void 0:n._$AD)===r)this._$AH.p(i);else{const o=new Xf(r,this),a=o.u(this.options);o.p(i),this.T(a),this._$AH=o}}_$AC(t){let i=Xc.get(t.strings);return i===void 0&&Xc.set(t.strings,i=new Mr(t)),i}k(t){Yl(this._$AH)||(this._$AH=[],this._$AR());const i=this._$AH;let s,r=0;for(const n of t)r===i.length?i.push(s=new Hr(this.O(Lr()),this.O(Lr()),this,this.options)):s=i[r],s._$AI(n),r++;r<i.length&&(this._$AR(s&&s._$AB.nextSibling,r),i.length=r)}_$AR(t=this._$AA.nextSibling,i){var s;for((s=this._$AP)==null?void 0:s.call(this,!1,!0,i);t!==this._$AB;){const r=Vc(t).nextSibling;Vc(t).remove(),t=r}}setConnected(t){var i;this._$AM===void 0&&(this._$Cv=t,(i=this._$AP)==null||i.call(this,t))}}class jn{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,i,s,r,n){this.type=1,this._$AH=Z,this._$AN=void 0,this.element=t,this.name=i,this._$AM=r,this.options=n,s.length>2||s[0]!==""||s[1]!==""?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=Z}_$AI(t,i=this,s,r){const n=this.strings;let o=!1;if(n===void 0)t=Xs(this,t,i,0),o=!Pr(t)||t!==this._$AH&&t!==Wt,o&&(this._$AH=t);else{const a=t;let c,d;for(t=n[0],c=0;c<n.length-1;c++)d=Xs(this,a[s+c],i,c),d===Wt&&(d=this._$AH[c]),o||(o=!Pr(d)||d!==this._$AH[c]),d===Z?t=Z:t!==Z&&(t+=(d??"")+n[c+1]),this._$AH[c]=d}o&&!r&&this.j(t)}j(t){t===Z?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class Jf extends jn{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===Z?void 0:t}}class Zf extends jn{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==Z)}}class Qf extends jn{constructor(t,i,s,r,n){super(t,i,s,r,n),this.type=5}_$AI(t,i=this){if((t=Xs(this,t,i,0)??Z)===Wt)return;const s=this._$AH,r=t===Z&&s!==Z||t.capture!==s.capture||t.once!==s.once||t.passive!==s.passive,n=t!==Z&&(s===Z||r);r&&this.element.removeEventListener(this.name,this,s),n&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){var i;typeof this._$AH=="function"?this._$AH.call(((i=this.options)==null?void 0:i.host)??this.element,t):this._$AH.handleEvent(t)}}class em{constructor(t,i,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=i,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(t){Xs(this,t)}}const xo=Ar.litHtmlPolyfillSupport;xo==null||xo(Mr,Hr),(Ar.litHtmlVersions??(Ar.litHtmlVersions=[])).push("3.3.2");const tm=(e,t,i)=>{const s=(i==null?void 0:i.renderBefore)??t;let r=s._$litPart$;if(r===void 0){const n=(i==null?void 0:i.renderBefore)??null;s._$litPart$=r=new Hr(t.insertBefore(Lr(),n),n,void 0,i??{})}return r._$AI(e),r};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ys=globalThis;let ye=class extends Vs{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var i;const t=super.createRenderRoot();return(i=this.renderOptions).renderBefore??(i.renderBefore=t.firstChild),t}update(t){const i=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=tm(i,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),(t=this._$Do)==null||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._$Do)==null||t.setConnected(!1)}render(){return Wt}};var Fh;ye._$litElement$=!0,ye.finalized=!0,(Fh=ys.litElementHydrateSupport)==null||Fh.call(ys,{LitElement:ye});const To=ys.litElementPolyfillSupport;To==null||To({LitElement:ye});(ys.litElementVersions??(ys.litElementVersions=[])).push("4.2.2");var im=ee`
  :host {
    --track-width: 2px;
    --track-color: rgb(128 128 128 / 25%);
    --indicator-color: var(--sl-color-primary-600);
    --speed: 2s;

    display: inline-flex;
    width: 1em;
    height: 1em;
    flex: none;
  }

  .spinner {
    flex: 1 1 auto;
    height: 100%;
    width: 100%;
  }

  .spinner__track,
  .spinner__indicator {
    fill: none;
    stroke-width: var(--track-width);
    r: calc(0.5em - var(--track-width) / 2);
    cx: 0.5em;
    cy: 0.5em;
    transform-origin: 50% 50%;
  }

  .spinner__track {
    stroke: var(--track-color);
    transform-origin: 0% 0%;
  }

  .spinner__indicator {
    stroke: var(--indicator-color);
    stroke-linecap: round;
    stroke-dasharray: 150% 75%;
    animation: spin var(--speed) linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
      stroke-dasharray: 0.05em, 3em;
    }

    50% {
      transform: rotate(450deg);
      stroke-dasharray: 1.375em, 1.375em;
    }

    100% {
      transform: rotate(1080deg);
      stroke-dasharray: 0.05em, 3em;
    }
  }
`;const Sl=new Set,Ws=new Map;let bs,Kl="ltr",Xl="en";const Wh=typeof MutationObserver<"u"&&typeof document<"u"&&typeof document.documentElement<"u";if(Wh){const e=new MutationObserver(Kh);Kl=document.documentElement.dir||"ltr",Xl=document.documentElement.lang||navigator.language,e.observe(document.documentElement,{attributes:!0,attributeFilter:["dir","lang"]})}function Yh(...e){e.map(t=>{const i=t.$code.toLowerCase();Ws.has(i)?Ws.set(i,Object.assign(Object.assign({},Ws.get(i)),t)):Ws.set(i,t),bs||(bs=t)}),Kh()}function Kh(){Wh&&(Kl=document.documentElement.dir||"ltr",Xl=document.documentElement.lang||navigator.language),[...Sl.keys()].map(e=>{typeof e.requestUpdate=="function"&&e.requestUpdate()})}let sm=class{constructor(t){this.host=t,this.host.addController(this)}hostConnected(){Sl.add(this.host)}hostDisconnected(){Sl.delete(this.host)}dir(){return`${this.host.dir||Kl}`.toLowerCase()}lang(){return`${this.host.lang||Xl}`.toLowerCase()}getTranslationData(t){var i,s;let r;try{r=new Intl.Locale(t.replace(/_/g,"-"))}catch{return{locale:void 0,language:"",region:"",primary:void 0,secondary:void 0}}const n=r.language.toLowerCase(),o=(s=(i=r.region)===null||i===void 0?void 0:i.toLowerCase())!==null&&s!==void 0?s:"",a=Ws.get(`${n}-${o}`),c=Ws.get(n);return{locale:r,language:n,region:o,primary:a,secondary:c}}exists(t,i){var s;const{primary:r,secondary:n}=this.getTranslationData((s=i.lang)!==null&&s!==void 0?s:this.lang());return i=Object.assign({includeFallback:!1},i),!!(r&&r[t]||n&&n[t]||i.includeFallback&&bs&&bs[t])}term(t,...i){const{primary:s,secondary:r}=this.getTranslationData(this.lang());let n;if(s&&s[t])n=s[t];else if(r&&r[t])n=r[t];else if(bs&&bs[t])n=bs[t];else return console.error(`No translation found for: ${String(t)}`),String(t);return typeof n=="function"?n(...i):n}date(t,i){return t=new Date(t),new Intl.DateTimeFormat(this.lang(),i).format(t)}number(t,i){return t=Number(t),isNaN(t)?"":new Intl.NumberFormat(this.lang(),i).format(t)}relativeTime(t,i,s){return new Intl.RelativeTimeFormat(this.lang(),s).format(t,i)}};var Xh={$code:"en",$name:"English",$dir:"ltr",carousel:"Carousel",clearEntry:"Clear entry",close:"Close",copied:"Copied",copy:"Copy",currentValue:"Current value",error:"Error",goToSlide:(e,t)=>`Go to slide ${e} of ${t}`,hidePassword:"Hide password",loading:"Loading",nextSlide:"Next slide",numOptionsSelected:e=>e===0?"No options selected":e===1?"1 option selected":`${e} options selected`,previousSlide:"Previous slide",progress:"Progress",remove:"Remove",resize:"Resize",scrollToEnd:"Scroll to end",scrollToStart:"Scroll to start",selectAColorFromTheScreen:"Select a color from the screen",showPassword:"Show password",slideNum:e=>`Slide ${e}`,toggleColorFormat:"Toggle color format"};Yh(Xh);var rm=Xh,Ot=class extends sm{};Yh(rm);var ze=ee`
  :host {
    box-sizing: border-box;
  }

  :host *,
  :host *::before,
  :host *::after {
    box-sizing: inherit;
  }

  [hidden] {
    display: none !important;
  }
`;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Oe=e=>(t,i)=>{i!==void 0?i.addInitializer(()=>{customElements.define(e,t)}):customElements.define(e,t)};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const nm={attribute:!0,type:String,converter:Ks,reflect:!1,hasChanged:Wl},om=(e=nm,t,i)=>{const{kind:s,metadata:r}=i;let n=globalThis.litPropertyMetadata.get(r);if(n===void 0&&globalThis.litPropertyMetadata.set(r,n=new Map),s==="setter"&&((e=Object.create(e)).wrapped=!0),n.set(i.name,e),s==="accessor"){const{name:o}=i;return{set(a){const c=t.get.call(this);t.set.call(this,a),this.requestUpdate(o,c,e,!0,a)},init(a){return a!==void 0&&this.C(o,void 0,e,a),a}}}if(s==="setter"){const{name:o}=i;return function(a){const c=this[o];t.call(this,a),this.requestUpdate(o,c,e,!0,a)}}throw Error("Unsupported decorator location: "+s)};function k(e){return(t,i)=>typeof i=="object"?om(e,t,i):((s,r,n)=>{const o=r.hasOwnProperty(n);return r.constructor.createProperty(n,s),o?Object.getOwnPropertyDescriptor(r,n):void 0})(e,t,i)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function U(e){return k({...e,state:!0,attribute:!1})}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function am(e){return(t,i)=>{const s=typeof t=="function"?t:t[i];Object.assign(s,e)}}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const lm=(e,t,i)=>(i.configurable=!0,i.enumerable=!0,Reflect.decorate&&typeof t!="object"&&Object.defineProperty(e,t,i),i);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function le(e,t){return(i,s,r)=>{const n=o=>{var a;return((a=o.renderRoot)==null?void 0:a.querySelector(e))??null};return lm(i,s,{get(){return n(this)}})}}var _n,Ae=class extends ye{constructor(){super(),Nf(this,_n,!1),this.initialReflectedProperties=new Map,Object.entries(this.constructor.dependencies).forEach(([e,t])=>{this.constructor.define(e,t)})}emit(e,t){const i=new CustomEvent(e,qi({bubbles:!0,cancelable:!1,composed:!0,detail:{}},t));return this.dispatchEvent(i),i}static define(e,t=this,i={}){const s=customElements.get(e);if(!s){try{customElements.define(e,t,i)}catch{customElements.define(e,class extends t{},i)}return}let r=" (unknown version)",n=r;"version"in t&&t.version&&(r=" v"+t.version),"version"in s&&s.version&&(n=" v"+s.version),!(r&&n&&r===n)&&console.warn(`Attempted to register <${e}>${r}, but <${e}>${n} has already been registered.`)}attributeChangedCallback(e,t,i){Df(this,_n)||(this.constructor.elementProperties.forEach((s,r)=>{s.reflect&&this[r]!=null&&this.initialReflectedProperties.set(r,this[r])}),Lf(this,_n,!0)),super.attributeChangedCallback(e,t,i)}willUpdate(e){super.willUpdate(e),this.initialReflectedProperties.forEach((t,i)=>{e.has(i)&&this[i]==null&&(this[i]=t)})}};_n=new WeakMap;Ae.version="2.20.1";Ae.dependencies={};E([k()],Ae.prototype,"dir",2);E([k()],Ae.prototype,"lang",2);var Gn=class extends Ae{constructor(){super(...arguments),this.localize=new Ot(this)}render(){return T`
      <svg part="base" class="spinner" role="progressbar" aria-label=${this.localize.term("loading")}>
        <circle class="spinner__track"></circle>
        <circle class="spinner__indicator"></circle>
      </svg>
    `}};Gn.styles=[ze,im];Gn.define("sl-spinner");var cm=ee`
  :host {
    display: block;
  }

  .form-control {
    position: relative;
    border: none;
    padding: 0;
    margin: 0;
  }

  .form-control__label {
    padding: 0;
  }

  .radio-group--required .radio-group__label::after {
    content: var(--sl-input-required-content);
    margin-inline-start: var(--sl-input-required-content-offset);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
`,Wn=ee`
  .form-control .form-control__label {
    display: none;
  }

  .form-control .form-control__help-text {
    display: none;
  }

  /* Label */
  .form-control--has-label .form-control__label {
    display: inline-block;
    color: var(--sl-input-label-color);
    margin-bottom: var(--sl-spacing-3x-small);
  }

  .form-control--has-label.form-control--small .form-control__label {
    font-size: var(--sl-input-label-font-size-small);
  }

  .form-control--has-label.form-control--medium .form-control__label {
    font-size: var(--sl-input-label-font-size-medium);
  }

  .form-control--has-label.form-control--large .form-control__label {
    font-size: var(--sl-input-label-font-size-large);
  }

  :host([required]) .form-control--has-label .form-control__label::after {
    content: var(--sl-input-required-content);
    margin-inline-start: var(--sl-input-required-content-offset);
    color: var(--sl-input-required-content-color);
  }

  /* Help text */
  .form-control--has-help-text .form-control__help-text {
    display: block;
    color: var(--sl-input-help-text-color);
    margin-top: var(--sl-spacing-3x-small);
  }

  .form-control--has-help-text.form-control--small .form-control__help-text {
    font-size: var(--sl-input-help-text-font-size-small);
  }

  .form-control--has-help-text.form-control--medium .form-control__help-text {
    font-size: var(--sl-input-help-text-font-size-medium);
  }

  .form-control--has-help-text.form-control--large .form-control__help-text {
    font-size: var(--sl-input-help-text-font-size-large);
  }

  .form-control--has-help-text.form-control--radio-group .form-control__help-text {
    margin-top: var(--sl-spacing-2x-small);
  }
`,dm=ee`
  :host {
    display: inline-block;
  }

  .button-group {
    display: flex;
    flex-wrap: nowrap;
  }
`,Vr=class extends Ae{constructor(){super(...arguments),this.disableRole=!1,this.label=""}handleFocus(e){const t=fr(e.target);t==null||t.toggleAttribute("data-sl-button-group__button--focus",!0)}handleBlur(e){const t=fr(e.target);t==null||t.toggleAttribute("data-sl-button-group__button--focus",!1)}handleMouseOver(e){const t=fr(e.target);t==null||t.toggleAttribute("data-sl-button-group__button--hover",!0)}handleMouseOut(e){const t=fr(e.target);t==null||t.toggleAttribute("data-sl-button-group__button--hover",!1)}handleSlotChange(){const e=[...this.defaultSlot.assignedElements({flatten:!0})];e.forEach(t=>{const i=e.indexOf(t),s=fr(t);s&&(s.toggleAttribute("data-sl-button-group__button",!0),s.toggleAttribute("data-sl-button-group__button--first",i===0),s.toggleAttribute("data-sl-button-group__button--inner",i>0&&i<e.length-1),s.toggleAttribute("data-sl-button-group__button--last",i===e.length-1),s.toggleAttribute("data-sl-button-group__button--radio",s.tagName.toLowerCase()==="sl-radio-button"))})}render(){return T`
      <div
        part="base"
        class="button-group"
        role="${this.disableRole?"presentation":"group"}"
        aria-label=${this.label}
        @focusout=${this.handleBlur}
        @focusin=${this.handleFocus}
        @mouseover=${this.handleMouseOver}
        @mouseout=${this.handleMouseOut}
      >
        <slot @slotchange=${this.handleSlotChange}></slot>
      </div>
    `}};Vr.styles=[ze,dm];E([le("slot")],Vr.prototype,"defaultSlot",2);E([U()],Vr.prototype,"disableRole",2);E([k()],Vr.prototype,"label",2);function fr(e){var t;const i="sl-button, sl-radio-button";return(t=e.closest(i))!=null?t:e.querySelector(i)}var mr=new WeakMap,gr=new WeakMap,br=new WeakMap,Co=new WeakSet,cn=new WeakMap,jr=class{constructor(e,t){this.handleFormData=i=>{const s=this.options.disabled(this.host),r=this.options.name(this.host),n=this.options.value(this.host),o=this.host.tagName.toLowerCase()==="sl-button";this.host.isConnected&&!s&&!o&&typeof r=="string"&&r.length>0&&typeof n<"u"&&(Array.isArray(n)?n.forEach(a=>{i.formData.append(r,a.toString())}):i.formData.append(r,n.toString()))},this.handleFormSubmit=i=>{var s;const r=this.options.disabled(this.host),n=this.options.reportValidity;this.form&&!this.form.noValidate&&((s=mr.get(this.form))==null||s.forEach(o=>{this.setUserInteracted(o,!0)})),this.form&&!this.form.noValidate&&!r&&!n(this.host)&&(i.preventDefault(),i.stopImmediatePropagation())},this.handleFormReset=()=>{this.options.setValue(this.host,this.options.defaultValue(this.host)),this.setUserInteracted(this.host,!1),cn.set(this.host,[])},this.handleInteraction=i=>{const s=cn.get(this.host);s.includes(i.type)||s.push(i.type),s.length===this.options.assumeInteractionOn.length&&this.setUserInteracted(this.host,!0)},this.checkFormValidity=()=>{if(this.form&&!this.form.noValidate){const i=this.form.querySelectorAll("*");for(const s of i)if(typeof s.checkValidity=="function"&&!s.checkValidity())return!1}return!0},this.reportFormValidity=()=>{if(this.form&&!this.form.noValidate){const i=this.form.querySelectorAll("*");for(const s of i)if(typeof s.reportValidity=="function"&&!s.reportValidity())return!1}return!0},(this.host=e).addController(this),this.options=qi({form:i=>{const s=i.form;if(s){const n=i.getRootNode().querySelector(`#${s}`);if(n)return n}return i.closest("form")},name:i=>i.name,value:i=>i.value,defaultValue:i=>i.defaultValue,disabled:i=>{var s;return(s=i.disabled)!=null?s:!1},reportValidity:i=>typeof i.reportValidity=="function"?i.reportValidity():!0,checkValidity:i=>typeof i.checkValidity=="function"?i.checkValidity():!0,setValue:(i,s)=>i.value=s,assumeInteractionOn:["sl-input"]},t)}hostConnected(){const e=this.options.form(this.host);e&&this.attachForm(e),cn.set(this.host,[]),this.options.assumeInteractionOn.forEach(t=>{this.host.addEventListener(t,this.handleInteraction)})}hostDisconnected(){this.detachForm(),cn.delete(this.host),this.options.assumeInteractionOn.forEach(e=>{this.host.removeEventListener(e,this.handleInteraction)})}hostUpdated(){const e=this.options.form(this.host);e||this.detachForm(),e&&this.form!==e&&(this.detachForm(),this.attachForm(e)),this.host.hasUpdated&&this.setValidity(this.host.validity.valid)}attachForm(e){e?(this.form=e,mr.has(this.form)?mr.get(this.form).add(this.host):mr.set(this.form,new Set([this.host])),this.form.addEventListener("formdata",this.handleFormData),this.form.addEventListener("submit",this.handleFormSubmit),this.form.addEventListener("reset",this.handleFormReset),gr.has(this.form)||(gr.set(this.form,this.form.reportValidity),this.form.reportValidity=()=>this.reportFormValidity()),br.has(this.form)||(br.set(this.form,this.form.checkValidity),this.form.checkValidity=()=>this.checkFormValidity())):this.form=void 0}detachForm(){if(!this.form)return;const e=mr.get(this.form);e&&(e.delete(this.host),e.size<=0&&(this.form.removeEventListener("formdata",this.handleFormData),this.form.removeEventListener("submit",this.handleFormSubmit),this.form.removeEventListener("reset",this.handleFormReset),gr.has(this.form)&&(this.form.reportValidity=gr.get(this.form),gr.delete(this.form)),br.has(this.form)&&(this.form.checkValidity=br.get(this.form),br.delete(this.form)),this.form=void 0))}setUserInteracted(e,t){t?Co.add(e):Co.delete(e),e.requestUpdate()}doAction(e,t){if(this.form){const i=document.createElement("button");i.type=e,i.style.position="absolute",i.style.width="0",i.style.height="0",i.style.clipPath="inset(50%)",i.style.overflow="hidden",i.style.whiteSpace="nowrap",t&&(i.name=t.name,i.value=t.value,["formaction","formenctype","formmethod","formnovalidate","formtarget"].forEach(s=>{t.hasAttribute(s)&&i.setAttribute(s,t.getAttribute(s))})),this.form.append(i),i.click(),i.remove()}}getForm(){var e;return(e=this.form)!=null?e:null}reset(e){this.doAction("reset",e)}submit(e){this.doAction("submit",e)}setValidity(e){const t=this.host,i=!!Co.has(t),s=!!t.required;t.toggleAttribute("data-required",s),t.toggleAttribute("data-optional",!s),t.toggleAttribute("data-invalid",!e),t.toggleAttribute("data-valid",e),t.toggleAttribute("data-user-invalid",!e&&i),t.toggleAttribute("data-user-valid",e&&i)}updateValidity(){const e=this.host;this.setValidity(e.validity.valid)}emitInvalidEvent(e){const t=new CustomEvent("sl-invalid",{bubbles:!1,composed:!1,cancelable:!0,detail:{}});e||t.preventDefault(),this.host.dispatchEvent(t)||e==null||e.preventDefault()}},Yn=Object.freeze({badInput:!1,customError:!1,patternMismatch:!1,rangeOverflow:!1,rangeUnderflow:!1,stepMismatch:!1,tooLong:!1,tooShort:!1,typeMismatch:!1,valid:!0,valueMissing:!1}),um=Object.freeze(qr(qi({},Yn),{valid:!1,valueMissing:!0})),hm=Object.freeze(qr(qi({},Yn),{valid:!1,customError:!0})),Ci=class{constructor(e,...t){this.slotNames=[],this.handleSlotChange=i=>{const s=i.target;(this.slotNames.includes("[default]")&&!s.name||s.name&&this.slotNames.includes(s.name))&&this.host.requestUpdate()},(this.host=e).addController(this),this.slotNames=t}hasDefaultSlot(){return[...this.host.childNodes].some(e=>{if(e.nodeType===e.TEXT_NODE&&e.textContent.trim()!=="")return!0;if(e.nodeType===e.ELEMENT_NODE){const t=e;if(t.tagName.toLowerCase()==="sl-visually-hidden")return!1;if(!t.hasAttribute("slot"))return!0}return!1})}hasNamedSlot(e){return this.host.querySelector(`:scope > [slot="${e}"]`)!==null}test(e){return e==="[default]"?this.hasDefaultSlot():this.hasNamedSlot(e)}hostConnected(){this.host.shadowRoot.addEventListener("slotchange",this.handleSlotChange)}hostDisconnected(){this.host.shadowRoot.removeEventListener("slotchange",this.handleSlotChange)}};function pm(e){if(!e)return"";const t=e.assignedNodes({flatten:!0});let i="";return[...t].forEach(s=>{s.nodeType===Node.TEXT_NODE&&(i+=s.textContent)}),i}function we(e,t){const i=qi({waitUntilFirstUpdate:!1},t);return(s,r)=>{const{update:n}=s,o=Array.isArray(e)?e:[e];s.update=function(a){o.forEach(c=>{const d=c;if(a.has(d)){const l=a.get(d),u=this[d];l!==u&&(!i.waitUntilFirstUpdate||this.hasUpdated)&&this[r](l,u)}}),n.call(this,a)}}}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Li={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4},Kn=e=>(...t)=>({_$litDirective$:e,values:t});let Xn=class{constructor(t){}get _$AU(){return this._$AM._$AU}_$AT(t,i,s){this._$Ct=t,this._$AM=i,this._$Ci=s}_$AS(t,i){return this.update(t,i)}update(t,i){return this.render(...i)}};/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ce=Kn(class extends Xn{constructor(e){var t;if(super(e),e.type!==Li.ATTRIBUTE||e.name!=="class"||((t=e.strings)==null?void 0:t.length)>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(e){return" "+Object.keys(e).filter(t=>e[t]).join(" ")+" "}update(e,[t]){var s,r;if(this.st===void 0){this.st=new Set,e.strings!==void 0&&(this.nt=new Set(e.strings.join(" ").split(/\s/).filter(n=>n!=="")));for(const n in t)t[n]&&!((s=this.nt)!=null&&s.has(n))&&this.st.add(n);return this.render(t)}const i=e.element.classList;for(const n of this.st)n in t||(i.remove(n),this.st.delete(n));for(const n in t){const o=!!t[n];o===this.st.has(n)||(r=this.nt)!=null&&r.has(n)||(o?(i.add(n),this.st.add(n)):(i.remove(n),this.st.delete(n)))}return Wt}});var ht=class extends Ae{constructor(){super(...arguments),this.formControlController=new jr(this),this.hasSlotController=new Ci(this,"help-text","label"),this.customValidityMessage="",this.hasButtonGroup=!1,this.errorMessage="",this.defaultValue="",this.label="",this.helpText="",this.name="option",this.value="",this.size="medium",this.form="",this.required=!1}get validity(){const e=this.required&&!this.value;return this.customValidityMessage!==""?hm:e?um:Yn}get validationMessage(){const e=this.required&&!this.value;return this.customValidityMessage!==""?this.customValidityMessage:e?this.validationInput.validationMessage:""}connectedCallback(){super.connectedCallback(),this.defaultValue=this.value}firstUpdated(){this.formControlController.updateValidity()}getAllRadios(){return[...this.querySelectorAll("sl-radio, sl-radio-button")]}handleRadioClick(e){const t=e.target.closest("sl-radio, sl-radio-button"),i=this.getAllRadios(),s=this.value;!t||t.disabled||(this.value=t.value,i.forEach(r=>r.checked=r===t),this.value!==s&&(this.emit("sl-change"),this.emit("sl-input")))}handleKeyDown(e){var t;if(!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key))return;const i=this.getAllRadios().filter(a=>!a.disabled),s=(t=i.find(a=>a.checked))!=null?t:i[0],r=e.key===" "?0:["ArrowUp","ArrowLeft"].includes(e.key)?-1:1,n=this.value;let o=i.indexOf(s)+r;o<0&&(o=i.length-1),o>i.length-1&&(o=0),this.getAllRadios().forEach(a=>{a.checked=!1,this.hasButtonGroup||a.setAttribute("tabindex","-1")}),this.value=i[o].value,i[o].checked=!0,this.hasButtonGroup?i[o].shadowRoot.querySelector("button").focus():(i[o].setAttribute("tabindex","0"),i[o].focus()),this.value!==n&&(this.emit("sl-change"),this.emit("sl-input")),e.preventDefault()}handleLabelClick(){this.focus()}handleInvalid(e){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(e)}async syncRadioElements(){var e,t;const i=this.getAllRadios();if(await Promise.all(i.map(async s=>{await s.updateComplete,s.checked=s.value===this.value,s.size=this.size})),this.hasButtonGroup=i.some(s=>s.tagName.toLowerCase()==="sl-radio-button"),i.length>0&&!i.some(s=>s.checked))if(this.hasButtonGroup){const s=(e=i[0].shadowRoot)==null?void 0:e.querySelector("button");s&&s.setAttribute("tabindex","0")}else i[0].setAttribute("tabindex","0");if(this.hasButtonGroup){const s=(t=this.shadowRoot)==null?void 0:t.querySelector("sl-button-group");s&&(s.disableRole=!0)}}syncRadios(){if(customElements.get("sl-radio")&&customElements.get("sl-radio-button")){this.syncRadioElements();return}customElements.get("sl-radio")?this.syncRadioElements():customElements.whenDefined("sl-radio").then(()=>this.syncRadios()),customElements.get("sl-radio-button")?this.syncRadioElements():customElements.whenDefined("sl-radio-button").then(()=>this.syncRadios())}updateCheckedRadio(){this.getAllRadios().forEach(t=>t.checked=t.value===this.value),this.formControlController.setValidity(this.validity.valid)}handleSizeChange(){this.syncRadios()}handleValueChange(){this.hasUpdated&&this.updateCheckedRadio()}checkValidity(){const e=this.required&&!this.value,t=this.customValidityMessage!=="";return e||t?(this.formControlController.emitInvalidEvent(),!1):!0}getForm(){return this.formControlController.getForm()}reportValidity(){const e=this.validity.valid;return this.errorMessage=this.customValidityMessage||e?"":this.validationInput.validationMessage,this.formControlController.setValidity(e),this.validationInput.hidden=!0,clearTimeout(this.validationTimeout),e||(this.validationInput.hidden=!1,this.validationInput.reportValidity(),this.validationTimeout=setTimeout(()=>this.validationInput.hidden=!0,1e4)),e}setCustomValidity(e=""){this.customValidityMessage=e,this.errorMessage=e,this.validationInput.setCustomValidity(e),this.formControlController.updateValidity()}focus(e){const t=this.getAllRadios(),i=t.find(n=>n.checked),s=t.find(n=>!n.disabled),r=i||s;r&&r.focus(e)}render(){const e=this.hasSlotController.test("label"),t=this.hasSlotController.test("help-text"),i=this.label?!0:!!e,s=this.helpText?!0:!!t,r=T`
      <slot @slotchange=${this.syncRadios} @click=${this.handleRadioClick} @keydown=${this.handleKeyDown}></slot>
    `;return T`
      <fieldset
        part="form-control"
        class=${Ce({"form-control":!0,"form-control--small":this.size==="small","form-control--medium":this.size==="medium","form-control--large":this.size==="large","form-control--radio-group":!0,"form-control--has-label":i,"form-control--has-help-text":s})}
        role="radiogroup"
        aria-labelledby="label"
        aria-describedby="help-text"
        aria-errormessage="error-message"
      >
        <label
          part="form-control-label"
          id="label"
          class="form-control__label"
          aria-hidden=${i?"false":"true"}
          @click=${this.handleLabelClick}
        >
          <slot name="label">${this.label}</slot>
        </label>

        <div part="form-control-input" class="form-control-input">
          <div class="visually-hidden">
            <div id="error-message" aria-live="assertive">${this.errorMessage}</div>
            <label class="radio-group__validation">
              <input
                type="text"
                class="radio-group__validation-input"
                ?required=${this.required}
                tabindex="-1"
                hidden
                @invalid=${this.handleInvalid}
              />
            </label>
          </div>

          ${this.hasButtonGroup?T`
                <sl-button-group part="button-group" exportparts="base:button-group__base" role="presentation">
                  ${r}
                </sl-button-group>
              `:r}
        </div>

        <div
          part="form-control-help-text"
          id="help-text"
          class="form-control__help-text"
          aria-hidden=${s?"false":"true"}
        >
          <slot name="help-text">${this.helpText}</slot>
        </div>
      </fieldset>
    `}};ht.styles=[ze,Wn,cm];ht.dependencies={"sl-button-group":Vr};E([le("slot:not([name])")],ht.prototype,"defaultSlot",2);E([le(".radio-group__validation-input")],ht.prototype,"validationInput",2);E([U()],ht.prototype,"hasButtonGroup",2);E([U()],ht.prototype,"errorMessage",2);E([U()],ht.prototype,"defaultValue",2);E([k()],ht.prototype,"label",2);E([k({attribute:"help-text"})],ht.prototype,"helpText",2);E([k()],ht.prototype,"name",2);E([k({reflect:!0})],ht.prototype,"value",2);E([k({reflect:!0})],ht.prototype,"size",2);E([k({reflect:!0})],ht.prototype,"form",2);E([k({type:Boolean,reflect:!0})],ht.prototype,"required",2);E([we("size",{waitUntilFirstUpdate:!0})],ht.prototype,"handleSizeChange",1);E([we("value")],ht.prototype,"handleValueChange",1);ht.define("sl-radio-group");var Jh=ee`
  :host {
    display: inline-block;
    position: relative;
    width: auto;
    cursor: pointer;
  }

  .button {
    display: inline-flex;
    align-items: stretch;
    justify-content: center;
    width: 100%;
    border-style: solid;
    border-width: var(--sl-input-border-width);
    font-family: var(--sl-input-font-family);
    font-weight: var(--sl-font-weight-semibold);
    text-decoration: none;
    user-select: none;
    -webkit-user-select: none;
    white-space: nowrap;
    vertical-align: middle;
    padding: 0;
    transition:
      var(--sl-transition-x-fast) background-color,
      var(--sl-transition-x-fast) color,
      var(--sl-transition-x-fast) border,
      var(--sl-transition-x-fast) box-shadow;
    cursor: inherit;
  }

  .button::-moz-focus-inner {
    border: 0;
  }

  .button:focus {
    outline: none;
  }

  .button:focus-visible {
    outline: var(--sl-focus-ring);
    outline-offset: var(--sl-focus-ring-offset);
  }

  .button--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* When disabled, prevent mouse events from bubbling up from children */
  .button--disabled * {
    pointer-events: none;
  }

  .button__prefix,
  .button__suffix {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    pointer-events: none;
  }

  .button__label {
    display: inline-block;
  }

  .button__label::slotted(sl-icon) {
    vertical-align: -2px;
  }

  /*
   * Standard buttons
   */

  /* Default */
  .button--standard.button--default {
    background-color: var(--sl-color-neutral-0);
    border-color: var(--sl-input-border-color);
    color: var(--sl-color-neutral-700);
  }

  .button--standard.button--default:hover:not(.button--disabled) {
    background-color: var(--sl-color-primary-50);
    border-color: var(--sl-color-primary-300);
    color: var(--sl-color-primary-700);
  }

  .button--standard.button--default:active:not(.button--disabled) {
    background-color: var(--sl-color-primary-100);
    border-color: var(--sl-color-primary-400);
    color: var(--sl-color-primary-700);
  }

  /* Primary */
  .button--standard.button--primary {
    background-color: var(--sl-color-primary-600);
    border-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--primary:hover:not(.button--disabled) {
    background-color: var(--sl-color-primary-500);
    border-color: var(--sl-color-primary-500);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--primary:active:not(.button--disabled) {
    background-color: var(--sl-color-primary-600);
    border-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
  }

  /* Success */
  .button--standard.button--success {
    background-color: var(--sl-color-success-600);
    border-color: var(--sl-color-success-600);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--success:hover:not(.button--disabled) {
    background-color: var(--sl-color-success-500);
    border-color: var(--sl-color-success-500);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--success:active:not(.button--disabled) {
    background-color: var(--sl-color-success-600);
    border-color: var(--sl-color-success-600);
    color: var(--sl-color-neutral-0);
  }

  /* Neutral */
  .button--standard.button--neutral {
    background-color: var(--sl-color-neutral-600);
    border-color: var(--sl-color-neutral-600);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--neutral:hover:not(.button--disabled) {
    background-color: var(--sl-color-neutral-500);
    border-color: var(--sl-color-neutral-500);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--neutral:active:not(.button--disabled) {
    background-color: var(--sl-color-neutral-600);
    border-color: var(--sl-color-neutral-600);
    color: var(--sl-color-neutral-0);
  }

  /* Warning */
  .button--standard.button--warning {
    background-color: var(--sl-color-warning-600);
    border-color: var(--sl-color-warning-600);
    color: var(--sl-color-neutral-0);
  }
  .button--standard.button--warning:hover:not(.button--disabled) {
    background-color: var(--sl-color-warning-500);
    border-color: var(--sl-color-warning-500);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--warning:active:not(.button--disabled) {
    background-color: var(--sl-color-warning-600);
    border-color: var(--sl-color-warning-600);
    color: var(--sl-color-neutral-0);
  }

  /* Danger */
  .button--standard.button--danger {
    background-color: var(--sl-color-danger-600);
    border-color: var(--sl-color-danger-600);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--danger:hover:not(.button--disabled) {
    background-color: var(--sl-color-danger-500);
    border-color: var(--sl-color-danger-500);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--danger:active:not(.button--disabled) {
    background-color: var(--sl-color-danger-600);
    border-color: var(--sl-color-danger-600);
    color: var(--sl-color-neutral-0);
  }

  /*
   * Outline buttons
   */

  .button--outline {
    background: none;
    border: solid 1px;
  }

  /* Default */
  .button--outline.button--default {
    border-color: var(--sl-input-border-color);
    color: var(--sl-color-neutral-700);
  }

  .button--outline.button--default:hover:not(.button--disabled),
  .button--outline.button--default.button--checked:not(.button--disabled) {
    border-color: var(--sl-color-primary-600);
    background-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--default:active:not(.button--disabled) {
    border-color: var(--sl-color-primary-700);
    background-color: var(--sl-color-primary-700);
    color: var(--sl-color-neutral-0);
  }

  /* Primary */
  .button--outline.button--primary {
    border-color: var(--sl-color-primary-600);
    color: var(--sl-color-primary-600);
  }

  .button--outline.button--primary:hover:not(.button--disabled),
  .button--outline.button--primary.button--checked:not(.button--disabled) {
    background-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--primary:active:not(.button--disabled) {
    border-color: var(--sl-color-primary-700);
    background-color: var(--sl-color-primary-700);
    color: var(--sl-color-neutral-0);
  }

  /* Success */
  .button--outline.button--success {
    border-color: var(--sl-color-success-600);
    color: var(--sl-color-success-600);
  }

  .button--outline.button--success:hover:not(.button--disabled),
  .button--outline.button--success.button--checked:not(.button--disabled) {
    background-color: var(--sl-color-success-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--success:active:not(.button--disabled) {
    border-color: var(--sl-color-success-700);
    background-color: var(--sl-color-success-700);
    color: var(--sl-color-neutral-0);
  }

  /* Neutral */
  .button--outline.button--neutral {
    border-color: var(--sl-color-neutral-600);
    color: var(--sl-color-neutral-600);
  }

  .button--outline.button--neutral:hover:not(.button--disabled),
  .button--outline.button--neutral.button--checked:not(.button--disabled) {
    background-color: var(--sl-color-neutral-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--neutral:active:not(.button--disabled) {
    border-color: var(--sl-color-neutral-700);
    background-color: var(--sl-color-neutral-700);
    color: var(--sl-color-neutral-0);
  }

  /* Warning */
  .button--outline.button--warning {
    border-color: var(--sl-color-warning-600);
    color: var(--sl-color-warning-600);
  }

  .button--outline.button--warning:hover:not(.button--disabled),
  .button--outline.button--warning.button--checked:not(.button--disabled) {
    background-color: var(--sl-color-warning-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--warning:active:not(.button--disabled) {
    border-color: var(--sl-color-warning-700);
    background-color: var(--sl-color-warning-700);
    color: var(--sl-color-neutral-0);
  }

  /* Danger */
  .button--outline.button--danger {
    border-color: var(--sl-color-danger-600);
    color: var(--sl-color-danger-600);
  }

  .button--outline.button--danger:hover:not(.button--disabled),
  .button--outline.button--danger.button--checked:not(.button--disabled) {
    background-color: var(--sl-color-danger-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--danger:active:not(.button--disabled) {
    border-color: var(--sl-color-danger-700);
    background-color: var(--sl-color-danger-700);
    color: var(--sl-color-neutral-0);
  }

  @media (forced-colors: active) {
    .button.button--outline.button--checked:not(.button--disabled) {
      outline: solid 2px transparent;
    }
  }

  /*
   * Text buttons
   */

  .button--text {
    background-color: transparent;
    border-color: transparent;
    color: var(--sl-color-primary-600);
  }

  .button--text:hover:not(.button--disabled) {
    background-color: transparent;
    border-color: transparent;
    color: var(--sl-color-primary-500);
  }

  .button--text:focus-visible:not(.button--disabled) {
    background-color: transparent;
    border-color: transparent;
    color: var(--sl-color-primary-500);
  }

  .button--text:active:not(.button--disabled) {
    background-color: transparent;
    border-color: transparent;
    color: var(--sl-color-primary-700);
  }

  /*
   * Size modifiers
   */

  .button--small {
    height: auto;
    min-height: var(--sl-input-height-small);
    font-size: var(--sl-button-font-size-small);
    line-height: calc(var(--sl-input-height-small) - var(--sl-input-border-width) * 2);
    border-radius: var(--sl-input-border-radius-small);
  }

  .button--medium {
    height: auto;
    min-height: var(--sl-input-height-medium);
    font-size: var(--sl-button-font-size-medium);
    line-height: calc(var(--sl-input-height-medium) - var(--sl-input-border-width) * 2);
    border-radius: var(--sl-input-border-radius-medium);
  }

  .button--large {
    height: auto;
    min-height: var(--sl-input-height-large);
    font-size: var(--sl-button-font-size-large);
    line-height: calc(var(--sl-input-height-large) - var(--sl-input-border-width) * 2);
    border-radius: var(--sl-input-border-radius-large);
  }

  /*
   * Pill modifier
   */

  .button--pill.button--small {
    border-radius: var(--sl-input-height-small);
  }

  .button--pill.button--medium {
    border-radius: var(--sl-input-height-medium);
  }

  .button--pill.button--large {
    border-radius: var(--sl-input-height-large);
  }

  /*
   * Circle modifier
   */

  .button--circle {
    padding-left: 0;
    padding-right: 0;
  }

  .button--circle.button--small {
    width: var(--sl-input-height-small);
    border-radius: 50%;
  }

  .button--circle.button--medium {
    width: var(--sl-input-height-medium);
    border-radius: 50%;
  }

  .button--circle.button--large {
    width: var(--sl-input-height-large);
    border-radius: 50%;
  }

  .button--circle .button__prefix,
  .button--circle .button__suffix,
  .button--circle .button__caret {
    display: none;
  }

  /*
   * Caret modifier
   */

  .button--caret .button__suffix {
    display: none;
  }

  .button--caret .button__caret {
    height: auto;
  }

  /*
   * Loading modifier
   */

  .button--loading {
    position: relative;
    cursor: wait;
  }

  .button--loading .button__prefix,
  .button--loading .button__label,
  .button--loading .button__suffix,
  .button--loading .button__caret {
    visibility: hidden;
  }

  .button--loading sl-spinner {
    --indicator-color: currentColor;
    position: absolute;
    font-size: 1em;
    height: 1em;
    width: 1em;
    top: calc(50% - 0.5em);
    left: calc(50% - 0.5em);
  }

  /*
   * Badges
   */

  .button ::slotted(sl-badge) {
    position: absolute;
    top: 0;
    right: 0;
    translate: 50% -50%;
    pointer-events: none;
  }

  .button--rtl ::slotted(sl-badge) {
    right: auto;
    left: 0;
    translate: -50% -50%;
  }

  /*
   * Button spacing
   */

  .button--has-label.button--small .button__label {
    padding: 0 var(--sl-spacing-small);
  }

  .button--has-label.button--medium .button__label {
    padding: 0 var(--sl-spacing-medium);
  }

  .button--has-label.button--large .button__label {
    padding: 0 var(--sl-spacing-large);
  }

  .button--has-prefix.button--small {
    padding-inline-start: var(--sl-spacing-x-small);
  }

  .button--has-prefix.button--small .button__label {
    padding-inline-start: var(--sl-spacing-x-small);
  }

  .button--has-prefix.button--medium {
    padding-inline-start: var(--sl-spacing-small);
  }

  .button--has-prefix.button--medium .button__label {
    padding-inline-start: var(--sl-spacing-small);
  }

  .button--has-prefix.button--large {
    padding-inline-start: var(--sl-spacing-small);
  }

  .button--has-prefix.button--large .button__label {
    padding-inline-start: var(--sl-spacing-small);
  }

  .button--has-suffix.button--small,
  .button--caret.button--small {
    padding-inline-end: var(--sl-spacing-x-small);
  }

  .button--has-suffix.button--small .button__label,
  .button--caret.button--small .button__label {
    padding-inline-end: var(--sl-spacing-x-small);
  }

  .button--has-suffix.button--medium,
  .button--caret.button--medium {
    padding-inline-end: var(--sl-spacing-small);
  }

  .button--has-suffix.button--medium .button__label,
  .button--caret.button--medium .button__label {
    padding-inline-end: var(--sl-spacing-small);
  }

  .button--has-suffix.button--large,
  .button--caret.button--large {
    padding-inline-end: var(--sl-spacing-small);
  }

  .button--has-suffix.button--large .button__label,
  .button--caret.button--large .button__label {
    padding-inline-end: var(--sl-spacing-small);
  }

  /*
   * Button groups support a variety of button types (e.g. buttons with tooltips, buttons as dropdown triggers, etc.).
   * This means buttons aren't always direct descendants of the button group, thus we can't target them with the
   * ::slotted selector. To work around this, the button group component does some magic to add these special classes to
   * buttons and we style them here instead.
   */

  :host([data-sl-button-group__button--first]:not([data-sl-button-group__button--last])) .button {
    border-start-end-radius: 0;
    border-end-end-radius: 0;
  }

  :host([data-sl-button-group__button--inner]) .button {
    border-radius: 0;
  }

  :host([data-sl-button-group__button--last]:not([data-sl-button-group__button--first])) .button {
    border-start-start-radius: 0;
    border-end-start-radius: 0;
  }

  /* All except the first */
  :host([data-sl-button-group__button]:not([data-sl-button-group__button--first])) {
    margin-inline-start: calc(-1 * var(--sl-input-border-width));
  }

  /* Add a visual separator between solid buttons */
  :host(
      [data-sl-button-group__button]:not(
          [data-sl-button-group__button--first],
          [data-sl-button-group__button--radio],
          [variant='default']
        ):not(:hover)
    )
    .button:after {
    content: '';
    position: absolute;
    top: 0;
    inset-inline-start: 0;
    bottom: 0;
    border-left: solid 1px rgb(128 128 128 / 33%);
    mix-blend-mode: multiply;
  }

  /* Bump hovered, focused, and checked buttons up so their focus ring isn't clipped */
  :host([data-sl-button-group__button--hover]) {
    z-index: 1;
  }

  /* Focus and checked are always on top */
  :host([data-sl-button-group__button--focus]),
  :host([data-sl-button-group__button][checked]) {
    z-index: 2;
  }
`,fm=ee`
  ${Jh}

  .button__prefix,
  .button__suffix,
  .button__label {
    display: inline-flex;
    position: relative;
    align-items: center;
  }

  /* We use a hidden input so constraint validation errors work, since they don't appear to show when used with buttons.
    We can't actually hide it, though, otherwise the messages will be suppressed by the browser. */
  .hidden-input {
    all: unset;
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    outline: dotted 1px red;
    opacity: 0;
    z-index: -1;
  }
`;/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Zh=Symbol.for(""),mm=e=>{if((e==null?void 0:e.r)===Zh)return e==null?void 0:e._$litStatic$},Sn=(e,...t)=>({_$litStatic$:t.reduce((i,s,r)=>i+(n=>{if(n._$litStatic$!==void 0)return n._$litStatic$;throw Error(`Value passed to 'literal' function must be a 'literal' result: ${n}. Use 'unsafeStatic' to pass non-literal values, but
            take care to ensure page security.`)})(s)+e[r+1],e[0]),r:Zh}),Jc=new Map,gm=e=>(t,...i)=>{const s=i.length;let r,n;const o=[],a=[];let c,d=0,l=!1;for(;d<s;){for(c=t[d];d<s&&(n=i[d],(r=mm(n))!==void 0);)c+=r+t[++d],l=!0;d!==s&&a.push(n),o.push(c),d++}if(d===s&&o.push(t[s]),l){const u=o.join("$$lit$$");(t=Jc.get(u))===void 0&&(o.raw=o,Jc.set(u,t=o)),i=a}return e(t,...i)},Ir=gm(T);/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const pe=e=>e??Z;var ni=class extends Ae{constructor(){super(...arguments),this.hasSlotController=new Ci(this,"[default]","prefix","suffix"),this.hasFocus=!1,this.checked=!1,this.disabled=!1,this.size="medium",this.pill=!1}connectedCallback(){super.connectedCallback(),this.setAttribute("role","presentation")}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleClick(e){if(this.disabled){e.preventDefault(),e.stopPropagation();return}this.checked=!0}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleDisabledChange(){this.setAttribute("aria-disabled",this.disabled?"true":"false")}focus(e){this.input.focus(e)}blur(){this.input.blur()}render(){return Ir`
      <div part="base" role="presentation">
        <button
          part="${`button${this.checked?" button--checked":""}`}"
          role="radio"
          aria-checked="${this.checked}"
          class=${Ce({button:!0,"button--default":!0,"button--small":this.size==="small","button--medium":this.size==="medium","button--large":this.size==="large","button--checked":this.checked,"button--disabled":this.disabled,"button--focused":this.hasFocus,"button--outline":!0,"button--pill":this.pill,"button--has-label":this.hasSlotController.test("[default]"),"button--has-prefix":this.hasSlotController.test("prefix"),"button--has-suffix":this.hasSlotController.test("suffix")})}
          aria-disabled=${this.disabled}
          type="button"
          value=${pe(this.value)}
          @blur=${this.handleBlur}
          @focus=${this.handleFocus}
          @click=${this.handleClick}
        >
          <slot name="prefix" part="prefix" class="button__prefix"></slot>
          <slot part="label" class="button__label"></slot>
          <slot name="suffix" part="suffix" class="button__suffix"></slot>
        </button>
      </div>
    `}};ni.styles=[ze,fm];E([le(".button")],ni.prototype,"input",2);E([le(".hidden-input")],ni.prototype,"hiddenInput",2);E([U()],ni.prototype,"hasFocus",2);E([k({type:Boolean,reflect:!0})],ni.prototype,"checked",2);E([k()],ni.prototype,"value",2);E([k({type:Boolean,reflect:!0})],ni.prototype,"disabled",2);E([k({reflect:!0})],ni.prototype,"size",2);E([k({type:Boolean,reflect:!0})],ni.prototype,"pill",2);E([we("disabled",{waitUntilFirstUpdate:!0})],ni.prototype,"handleDisabledChange",1);ni.define("sl-radio-button");var bm=ee`
  :host {
    display: inline-block;
  }

  .tag {
    display: flex;
    align-items: center;
    border: solid 1px;
    line-height: 1;
    white-space: nowrap;
    user-select: none;
    -webkit-user-select: none;
  }

  .tag__remove::part(base) {
    color: inherit;
    padding: 0;
  }

  /*
   * Variant modifiers
   */

  .tag--primary {
    background-color: var(--sl-color-primary-50);
    border-color: var(--sl-color-primary-200);
    color: var(--sl-color-primary-800);
  }

  .tag--primary:active > sl-icon-button {
    color: var(--sl-color-primary-600);
  }

  .tag--success {
    background-color: var(--sl-color-success-50);
    border-color: var(--sl-color-success-200);
    color: var(--sl-color-success-800);
  }

  .tag--success:active > sl-icon-button {
    color: var(--sl-color-success-600);
  }

  .tag--neutral {
    background-color: var(--sl-color-neutral-50);
    border-color: var(--sl-color-neutral-200);
    color: var(--sl-color-neutral-800);
  }

  .tag--neutral:active > sl-icon-button {
    color: var(--sl-color-neutral-600);
  }

  .tag--warning {
    background-color: var(--sl-color-warning-50);
    border-color: var(--sl-color-warning-200);
    color: var(--sl-color-warning-800);
  }

  .tag--warning:active > sl-icon-button {
    color: var(--sl-color-warning-600);
  }

  .tag--danger {
    background-color: var(--sl-color-danger-50);
    border-color: var(--sl-color-danger-200);
    color: var(--sl-color-danger-800);
  }

  .tag--danger:active > sl-icon-button {
    color: var(--sl-color-danger-600);
  }

  /*
   * Size modifiers
   */

  .tag--small {
    font-size: var(--sl-button-font-size-small);
    height: calc(var(--sl-input-height-small) * 0.8);
    line-height: calc(var(--sl-input-height-small) - var(--sl-input-border-width) * 2);
    border-radius: var(--sl-input-border-radius-small);
    padding: 0 var(--sl-spacing-x-small);
  }

  .tag--medium {
    font-size: var(--sl-button-font-size-medium);
    height: calc(var(--sl-input-height-medium) * 0.8);
    line-height: calc(var(--sl-input-height-medium) - var(--sl-input-border-width) * 2);
    border-radius: var(--sl-input-border-radius-medium);
    padding: 0 var(--sl-spacing-small);
  }

  .tag--large {
    font-size: var(--sl-button-font-size-large);
    height: calc(var(--sl-input-height-large) * 0.8);
    line-height: calc(var(--sl-input-height-large) - var(--sl-input-border-width) * 2);
    border-radius: var(--sl-input-border-radius-large);
    padding: 0 var(--sl-spacing-medium);
  }

  .tag__remove {
    margin-inline-start: var(--sl-spacing-x-small);
  }

  /*
   * Pill modifier
   */

  .tag--pill {
    border-radius: var(--sl-border-radius-pill);
  }
`,vm=ee`
  :host {
    display: inline-block;
    color: var(--sl-color-neutral-600);
  }

  .icon-button {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    background: none;
    border: none;
    border-radius: var(--sl-border-radius-medium);
    font-size: inherit;
    color: inherit;
    padding: var(--sl-spacing-x-small);
    cursor: pointer;
    transition: var(--sl-transition-x-fast) color;
    -webkit-appearance: none;
  }

  .icon-button:hover:not(.icon-button--disabled),
  .icon-button:focus-visible:not(.icon-button--disabled) {
    color: var(--sl-color-primary-600);
  }

  .icon-button:active:not(.icon-button--disabled) {
    color: var(--sl-color-primary-700);
  }

  .icon-button:focus {
    outline: none;
  }

  .icon-button--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .icon-button:focus-visible {
    outline: var(--sl-focus-ring);
    outline-offset: var(--sl-focus-ring-offset);
  }

  .icon-button__icon {
    pointer-events: none;
  }
`,ym={name:"default",resolver:e=>Sf(`assets/icons/${e}.svg`)},wm=ym,Zc={caret:`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `,check:`
    <svg part="checked-icon" class="checkbox__icon" viewBox="0 0 16 16">
      <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-linecap="round">
        <g stroke="currentColor">
          <g transform="translate(3.428571, 3.428571)">
            <path d="M0,5.71428571 L3.42857143,9.14285714"></path>
            <path d="M9.14285714,0 L3.42857143,9.14285714"></path>
          </g>
        </g>
      </g>
    </svg>
  `,"chevron-down":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-down" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
    </svg>
  `,"chevron-left":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-left" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
    </svg>
  `,"chevron-right":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-right" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
    </svg>
  `,copy:`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-copy" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6ZM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2Z"/>
    </svg>
  `,eye:`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye" viewBox="0 0 16 16">
      <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
      <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
    </svg>
  `,"eye-slash":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye-slash" viewBox="0 0 16 16">
      <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
      <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
      <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
    </svg>
  `,eyedropper:`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eyedropper" viewBox="0 0 16 16">
      <path d="M13.354.646a1.207 1.207 0 0 0-1.708 0L8.5 3.793l-.646-.647a.5.5 0 1 0-.708.708L8.293 5l-7.147 7.146A.5.5 0 0 0 1 12.5v1.793l-.854.853a.5.5 0 1 0 .708.707L1.707 15H3.5a.5.5 0 0 0 .354-.146L11 7.707l1.146 1.147a.5.5 0 0 0 .708-.708l-.647-.646 3.147-3.146a1.207 1.207 0 0 0 0-1.708l-2-2zM2 12.707l7-7L10.293 7l-7 7H2v-1.293z"></path>
    </svg>
  `,"grip-vertical":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical" viewBox="0 0 16 16">
      <path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"></path>
    </svg>
  `,indeterminate:`
    <svg part="indeterminate-icon" class="checkbox__icon" viewBox="0 0 16 16">
      <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-linecap="round">
        <g stroke="currentColor" stroke-width="2">
          <g transform="translate(2.285714, 6.857143)">
            <path d="M10.2857143,1.14285714 L1.14285714,1.14285714"></path>
          </g>
        </g>
      </g>
    </svg>
  `,"person-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-person-fill" viewBox="0 0 16 16">
      <path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
    </svg>
  `,"play-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
      <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"></path>
    </svg>
  `,"pause-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pause-fill" viewBox="0 0 16 16">
      <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"></path>
    </svg>
  `,radio:`
    <svg part="checked-icon" class="radio__icon" viewBox="0 0 16 16">
      <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <g fill="currentColor">
          <circle cx="8" cy="8" r="3.42857143"></circle>
        </g>
      </g>
    </svg>
  `,"star-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-star-fill" viewBox="0 0 16 16">
      <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
    </svg>
  `,"x-lg":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-lg" viewBox="0 0 16 16">
      <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
    </svg>
  `,"x-circle-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle-fill" viewBox="0 0 16 16">
      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"></path>
    </svg>
  `},_m={name:"system",resolver:e=>e in Zc?`data:image/svg+xml,${encodeURIComponent(Zc[e])}`:""},km=_m,Em=[wm,km],Ol=[];function xm(e){Ol.push(e)}function Tm(e){Ol=Ol.filter(t=>t!==e)}function Qc(e){return Em.find(t=>t.name===e)}var Cm=ee`
  :host {
    display: inline-block;
    width: 1em;
    height: 1em;
    box-sizing: content-box !important;
  }

  svg {
    display: block;
    height: 100%;
    width: 100%;
  }
`;/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Sm=(e,t)=>(e==null?void 0:e._$litType$)!==void 0,Qh=e=>e.strings===void 0,Om={},Am=(e,t=Om)=>e._$AH=t;var vr=Symbol(),dn=Symbol(),So,Oo=new Map,pt=class extends Ae{constructor(){super(...arguments),this.initialRender=!1,this.svg=null,this.label="",this.library="default"}async resolveIcon(e,t){var i;let s;if(t!=null&&t.spriteSheet)return this.svg=T`<svg part="svg">
        <use part="use" href="${e}"></use>
      </svg>`,this.svg;try{if(s=await fetch(e,{mode:"cors"}),!s.ok)return s.status===410?vr:dn}catch{return dn}try{const r=document.createElement("div");r.innerHTML=await s.text();const n=r.firstElementChild;if(((i=n==null?void 0:n.tagName)==null?void 0:i.toLowerCase())!=="svg")return vr;So||(So=new DOMParser);const a=So.parseFromString(n.outerHTML,"text/html").body.querySelector("svg");return a?(a.part.add("svg"),document.adoptNode(a)):vr}catch{return vr}}connectedCallback(){super.connectedCallback(),xm(this)}firstUpdated(){this.initialRender=!0,this.setIcon()}disconnectedCallback(){super.disconnectedCallback(),Tm(this)}getIconSource(){const e=Qc(this.library);return this.name&&e?{url:e.resolver(this.name),fromLibrary:!0}:{url:this.src,fromLibrary:!1}}handleLabelChange(){typeof this.label=="string"&&this.label.length>0?(this.setAttribute("role","img"),this.setAttribute("aria-label",this.label),this.removeAttribute("aria-hidden")):(this.removeAttribute("role"),this.removeAttribute("aria-label"),this.setAttribute("aria-hidden","true"))}async setIcon(){var e;const{url:t,fromLibrary:i}=this.getIconSource(),s=i?Qc(this.library):void 0;if(!t){this.svg=null;return}let r=Oo.get(t);if(r||(r=this.resolveIcon(t,s),Oo.set(t,r)),!this.initialRender)return;const n=await r;if(n===dn&&Oo.delete(t),t===this.getIconSource().url){if(Sm(n)){if(this.svg=n,s){await this.updateComplete;const o=this.shadowRoot.querySelector("[part='svg']");typeof s.mutator=="function"&&o&&s.mutator(o)}return}switch(n){case dn:case vr:this.svg=null,this.emit("sl-error");break;default:this.svg=n.cloneNode(!0),(e=s==null?void 0:s.mutator)==null||e.call(s,this.svg),this.emit("sl-load")}}}render(){return this.svg}};pt.styles=[ze,Cm];E([U()],pt.prototype,"svg",2);E([k({reflect:!0})],pt.prototype,"name",2);E([k()],pt.prototype,"src",2);E([k()],pt.prototype,"label",2);E([k({reflect:!0})],pt.prototype,"library",2);E([we("label")],pt.prototype,"handleLabelChange",1);E([we(["name","src","library"])],pt.prototype,"setIcon",1);var at=class extends Ae{constructor(){super(...arguments),this.hasFocus=!1,this.label="",this.disabled=!1}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleClick(e){this.disabled&&(e.preventDefault(),e.stopPropagation())}click(){this.button.click()}focus(e){this.button.focus(e)}blur(){this.button.blur()}render(){const e=!!this.href,t=e?Sn`a`:Sn`button`;return Ir`
      <${t}
        part="base"
        class=${Ce({"icon-button":!0,"icon-button--disabled":!e&&this.disabled,"icon-button--focused":this.hasFocus})}
        ?disabled=${pe(e?void 0:this.disabled)}
        type=${pe(e?void 0:"button")}
        href=${pe(e?this.href:void 0)}
        target=${pe(e?this.target:void 0)}
        download=${pe(e?this.download:void 0)}
        rel=${pe(e&&this.target?"noreferrer noopener":void 0)}
        role=${pe(e?void 0:"button")}
        aria-disabled=${this.disabled?"true":"false"}
        aria-label="${this.label}"
        tabindex=${this.disabled?"-1":"0"}
        @blur=${this.handleBlur}
        @focus=${this.handleFocus}
        @click=${this.handleClick}
      >
        <sl-icon
          class="icon-button__icon"
          name=${pe(this.name)}
          library=${pe(this.library)}
          src=${pe(this.src)}
          aria-hidden="true"
        ></sl-icon>
      </${t}>
    `}};at.styles=[ze,vm];at.dependencies={"sl-icon":pt};E([le(".icon-button")],at.prototype,"button",2);E([U()],at.prototype,"hasFocus",2);E([k()],at.prototype,"name",2);E([k()],at.prototype,"library",2);E([k()],at.prototype,"src",2);E([k()],at.prototype,"href",2);E([k()],at.prototype,"target",2);E([k()],at.prototype,"download",2);E([k()],at.prototype,"label",2);E([k({type:Boolean,reflect:!0})],at.prototype,"disabled",2);var as=class extends Ae{constructor(){super(...arguments),this.localize=new Ot(this),this.variant="neutral",this.size="medium",this.pill=!1,this.removable=!1}handleRemoveClick(){this.emit("sl-remove")}render(){return T`
      <span
        part="base"
        class=${Ce({tag:!0,"tag--primary":this.variant==="primary","tag--success":this.variant==="success","tag--neutral":this.variant==="neutral","tag--warning":this.variant==="warning","tag--danger":this.variant==="danger","tag--text":this.variant==="text","tag--small":this.size==="small","tag--medium":this.size==="medium","tag--large":this.size==="large","tag--pill":this.pill,"tag--removable":this.removable})}
      >
        <slot part="content" class="tag__content"></slot>

        ${this.removable?T`
              <sl-icon-button
                part="remove-button"
                exportparts="base:remove-button__base"
                name="x-lg"
                library="system"
                label=${this.localize.term("remove")}
                class="tag__remove"
                @click=${this.handleRemoveClick}
                tabindex="-1"
              ></sl-icon-button>
            `:""}
      </span>
    `}};as.styles=[ze,bm];as.dependencies={"sl-icon-button":at};E([k({reflect:!0})],as.prototype,"variant",2);E([k({reflect:!0})],as.prototype,"size",2);E([k({type:Boolean,reflect:!0})],as.prototype,"pill",2);E([k({type:Boolean})],as.prototype,"removable",2);var Im=ee`
  :host {
    display: block;
  }

  /** The popup */
  .select {
    flex: 1 1 auto;
    display: inline-flex;
    width: 100%;
    position: relative;
    vertical-align: middle;
  }

  .select::part(popup) {
    z-index: var(--sl-z-index-dropdown);
  }

  .select[data-current-placement^='top']::part(popup) {
    transform-origin: bottom;
  }

  .select[data-current-placement^='bottom']::part(popup) {
    transform-origin: top;
  }

  /* Combobox */
  .select__combobox {
    flex: 1;
    display: flex;
    width: 100%;
    min-width: 0;
    position: relative;
    align-items: center;
    justify-content: start;
    font-family: var(--sl-input-font-family);
    font-weight: var(--sl-input-font-weight);
    letter-spacing: var(--sl-input-letter-spacing);
    vertical-align: middle;
    overflow: hidden;
    cursor: pointer;
    transition:
      var(--sl-transition-fast) color,
      var(--sl-transition-fast) border,
      var(--sl-transition-fast) box-shadow,
      var(--sl-transition-fast) background-color;
  }

  .select__display-input {
    position: relative;
    width: 100%;
    font: inherit;
    border: none;
    background: none;
    color: var(--sl-input-color);
    cursor: inherit;
    overflow: hidden;
    padding: 0;
    margin: 0;
    -webkit-appearance: none;
  }

  .select__display-input::placeholder {
    color: var(--sl-input-placeholder-color);
  }

  .select:not(.select--disabled):hover .select__display-input {
    color: var(--sl-input-color-hover);
  }

  .select__display-input:focus {
    outline: none;
  }

  /* Visually hide the display input when multiple is enabled */
  .select--multiple:not(.select--placeholder-visible) .select__display-input {
    position: absolute;
    z-index: -1;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
  }

  .select__value-input {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
    opacity: 0;
    z-index: -1;
  }

  .select__tags {
    display: flex;
    flex: 1;
    align-items: center;
    flex-wrap: wrap;
    margin-inline-start: var(--sl-spacing-2x-small);
  }

  .select__tags::slotted(sl-tag) {
    cursor: pointer !important;
  }

  .select--disabled .select__tags,
  .select--disabled .select__tags::slotted(sl-tag) {
    cursor: not-allowed !important;
  }

  /* Standard selects */
  .select--standard .select__combobox {
    background-color: var(--sl-input-background-color);
    border: solid var(--sl-input-border-width) var(--sl-input-border-color);
  }

  .select--standard.select--disabled .select__combobox {
    background-color: var(--sl-input-background-color-disabled);
    border-color: var(--sl-input-border-color-disabled);
    color: var(--sl-input-color-disabled);
    opacity: 0.5;
    cursor: not-allowed;
    outline: none;
  }

  .select--standard:not(.select--disabled).select--open .select__combobox,
  .select--standard:not(.select--disabled).select--focused .select__combobox {
    background-color: var(--sl-input-background-color-focus);
    border-color: var(--sl-input-border-color-focus);
    box-shadow: 0 0 0 var(--sl-focus-ring-width) var(--sl-input-focus-ring-color);
  }

  /* Filled selects */
  .select--filled .select__combobox {
    border: none;
    background-color: var(--sl-input-filled-background-color);
    color: var(--sl-input-color);
  }

  .select--filled:hover:not(.select--disabled) .select__combobox {
    background-color: var(--sl-input-filled-background-color-hover);
  }

  .select--filled.select--disabled .select__combobox {
    background-color: var(--sl-input-filled-background-color-disabled);
    opacity: 0.5;
    cursor: not-allowed;
  }

  .select--filled:not(.select--disabled).select--open .select__combobox,
  .select--filled:not(.select--disabled).select--focused .select__combobox {
    background-color: var(--sl-input-filled-background-color-focus);
    outline: var(--sl-focus-ring);
  }

  /* Sizes */
  .select--small .select__combobox {
    border-radius: var(--sl-input-border-radius-small);
    font-size: var(--sl-input-font-size-small);
    min-height: var(--sl-input-height-small);
    padding-block: 0;
    padding-inline: var(--sl-input-spacing-small);
  }

  .select--small .select__clear {
    margin-inline-start: var(--sl-input-spacing-small);
  }

  .select--small .select__prefix::slotted(*) {
    margin-inline-end: var(--sl-input-spacing-small);
  }

  .select--small.select--multiple:not(.select--placeholder-visible) .select__prefix::slotted(*) {
    margin-inline-start: var(--sl-input-spacing-small);
  }

  .select--small.select--multiple:not(.select--placeholder-visible) .select__combobox {
    padding-block: 2px;
    padding-inline-start: 0;
  }

  .select--small .select__tags {
    gap: 2px;
  }

  .select--medium .select__combobox {
    border-radius: var(--sl-input-border-radius-medium);
    font-size: var(--sl-input-font-size-medium);
    min-height: var(--sl-input-height-medium);
    padding-block: 0;
    padding-inline: var(--sl-input-spacing-medium);
  }

  .select--medium .select__clear {
    margin-inline-start: var(--sl-input-spacing-medium);
  }

  .select--medium .select__prefix::slotted(*) {
    margin-inline-end: var(--sl-input-spacing-medium);
  }

  .select--medium.select--multiple:not(.select--placeholder-visible) .select__prefix::slotted(*) {
    margin-inline-start: var(--sl-input-spacing-medium);
  }

  .select--medium.select--multiple:not(.select--placeholder-visible) .select__combobox {
    padding-inline-start: 0;
    padding-block: 3px;
  }

  .select--medium .select__tags {
    gap: 3px;
  }

  .select--large .select__combobox {
    border-radius: var(--sl-input-border-radius-large);
    font-size: var(--sl-input-font-size-large);
    min-height: var(--sl-input-height-large);
    padding-block: 0;
    padding-inline: var(--sl-input-spacing-large);
  }

  .select--large .select__clear {
    margin-inline-start: var(--sl-input-spacing-large);
  }

  .select--large .select__prefix::slotted(*) {
    margin-inline-end: var(--sl-input-spacing-large);
  }

  .select--large.select--multiple:not(.select--placeholder-visible) .select__prefix::slotted(*) {
    margin-inline-start: var(--sl-input-spacing-large);
  }

  .select--large.select--multiple:not(.select--placeholder-visible) .select__combobox {
    padding-inline-start: 0;
    padding-block: 4px;
  }

  .select--large .select__tags {
    gap: 4px;
  }

  /* Pills */
  .select--pill.select--small .select__combobox {
    border-radius: var(--sl-input-height-small);
  }

  .select--pill.select--medium .select__combobox {
    border-radius: var(--sl-input-height-medium);
  }

  .select--pill.select--large .select__combobox {
    border-radius: var(--sl-input-height-large);
  }

  /* Prefix and Suffix */
  .select__prefix,
  .select__suffix {
    flex: 0;
    display: inline-flex;
    align-items: center;
    color: var(--sl-input-placeholder-color);
  }

  .select__suffix::slotted(*) {
    margin-inline-start: var(--sl-spacing-small);
  }

  /* Clear button */
  .select__clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: inherit;
    color: var(--sl-input-icon-color);
    border: none;
    background: none;
    padding: 0;
    transition: var(--sl-transition-fast) color;
    cursor: pointer;
  }

  .select__clear:hover {
    color: var(--sl-input-icon-color-hover);
  }

  .select__clear:focus {
    outline: none;
  }

  /* Expand icon */
  .select__expand-icon {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    transition: var(--sl-transition-medium) rotate ease;
    rotate: 0;
    margin-inline-start: var(--sl-spacing-small);
  }

  .select--open .select__expand-icon {
    rotate: -180deg;
  }

  /* Listbox */
  .select__listbox {
    display: block;
    position: relative;
    font-family: var(--sl-font-sans);
    font-size: var(--sl-font-size-medium);
    font-weight: var(--sl-font-weight-normal);
    box-shadow: var(--sl-shadow-large);
    background: var(--sl-panel-background-color);
    border: solid var(--sl-panel-border-width) var(--sl-panel-border-color);
    border-radius: var(--sl-border-radius-medium);
    padding-block: var(--sl-spacing-x-small);
    padding-inline: 0;
    overflow: auto;
    overscroll-behavior: none;

    /* Make sure it adheres to the popup's auto size */
    max-width: var(--auto-size-available-width);
    max-height: var(--auto-size-available-height);
  }

  .select__listbox ::slotted(sl-divider) {
    --spacing: var(--sl-spacing-x-small);
  }

  .select__listbox ::slotted(small) {
    display: block;
    font-size: var(--sl-font-size-small);
    font-weight: var(--sl-font-weight-semibold);
    color: var(--sl-color-neutral-500);
    padding-block: var(--sl-spacing-2x-small);
    padding-inline: var(--sl-spacing-x-large);
  }
`;function Rm(e,t){return{top:Math.round(e.getBoundingClientRect().top-t.getBoundingClientRect().top),left:Math.round(e.getBoundingClientRect().left-t.getBoundingClientRect().left)}}var Al=new Set;function $m(){const e=document.documentElement.clientWidth;return Math.abs(window.innerWidth-e)}function Dm(){const e=Number(getComputedStyle(document.body).paddingRight.replace(/px/,""));return isNaN(e)||!e?0:e}function ed(e){if(Al.add(e),!document.documentElement.classList.contains("sl-scroll-lock")){const t=$m()+Dm();let i=getComputedStyle(document.documentElement).scrollbarGutter;(!i||i==="auto")&&(i="stable"),t<2&&(i=""),document.documentElement.style.setProperty("--sl-scroll-lock-gutter",i),document.documentElement.classList.add("sl-scroll-lock"),document.documentElement.style.setProperty("--sl-scroll-lock-size",`${t}px`)}}function td(e){Al.delete(e),Al.size===0&&(document.documentElement.classList.remove("sl-scroll-lock"),document.documentElement.style.removeProperty("--sl-scroll-lock-size"))}function Il(e,t,i="vertical",s="smooth"){const r=Rm(e,t),n=r.top+t.scrollTop,o=r.left+t.scrollLeft,a=t.scrollLeft,c=t.scrollLeft+t.offsetWidth,d=t.scrollTop,l=t.scrollTop+t.offsetHeight;(i==="horizontal"||i==="both")&&(o<a?t.scrollTo({left:o,behavior:s}):o+e.clientWidth>c&&t.scrollTo({left:o-t.offsetWidth+e.clientWidth,behavior:s})),(i==="vertical"||i==="both")&&(n<d?t.scrollTo({top:n,behavior:s}):n+e.clientHeight>l&&t.scrollTo({top:n-t.offsetHeight+e.clientHeight,behavior:s}))}var Nm=ee`
  :host {
    --arrow-color: var(--sl-color-neutral-1000);
    --arrow-size: 6px;

    /*
     * These properties are computed to account for the arrow's dimensions after being rotated 45º. The constant
     * 0.7071 is derived from sin(45), which is the diagonal size of the arrow's container after rotating.
     */
    --arrow-size-diagonal: calc(var(--arrow-size) * 0.7071);
    --arrow-padding-offset: calc(var(--arrow-size-diagonal) - var(--arrow-size));

    display: contents;
  }

  .popup {
    position: absolute;
    isolation: isolate;
    max-width: var(--auto-size-available-width, none);
    max-height: var(--auto-size-available-height, none);
  }

  .popup--fixed {
    position: fixed;
  }

  .popup:not(.popup--active) {
    display: none;
  }

  .popup__arrow {
    position: absolute;
    width: calc(var(--arrow-size-diagonal) * 2);
    height: calc(var(--arrow-size-diagonal) * 2);
    rotate: 45deg;
    background: var(--arrow-color);
    z-index: -1;
  }

  /* Hover bridge */
  .popup-hover-bridge:not(.popup-hover-bridge--visible) {
    display: none;
  }

  .popup-hover-bridge {
    position: fixed;
    z-index: calc(var(--sl-z-index-dropdown) - 1);
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    clip-path: polygon(
      var(--hover-bridge-top-left-x, 0) var(--hover-bridge-top-left-y, 0),
      var(--hover-bridge-top-right-x, 0) var(--hover-bridge-top-right-y, 0),
      var(--hover-bridge-bottom-right-x, 0) var(--hover-bridge-bottom-right-y, 0),
      var(--hover-bridge-bottom-left-x, 0) var(--hover-bridge-bottom-left-y, 0)
    );
  }
`;const Qi=Math.min,Ft=Math.max,On=Math.round,un=Math.floor,ki=e=>({x:e,y:e}),Lm={left:"right",right:"left",bottom:"top",top:"bottom"};function Rl(e,t,i){return Ft(e,Qi(t,i))}function tr(e,t){return typeof e=="function"?e(t):e}function es(e){return e.split("-")[0]}function ir(e){return e.split("-")[1]}function ep(e){return e==="x"?"y":"x"}function Jl(e){return e==="y"?"height":"width"}function Pi(e){const t=e[0];return t==="t"||t==="b"?"y":"x"}function Zl(e){return ep(Pi(e))}function Pm(e,t,i){i===void 0&&(i=!1);const s=ir(e),r=Zl(e),n=Jl(r);let o=r==="x"?s===(i?"end":"start")?"right":"left":s==="start"?"bottom":"top";return t.reference[n]>t.floating[n]&&(o=An(o)),[o,An(o)]}function Mm(e){const t=An(e);return[$l(e),t,$l(t)]}function $l(e){return e.includes("start")?e.replace("start","end"):e.replace("end","start")}const id=["left","right"],sd=["right","left"],Fm=["top","bottom"],zm=["bottom","top"];function Bm(e,t,i){switch(e){case"top":case"bottom":return i?t?sd:id:t?id:sd;case"left":case"right":return t?Fm:zm;default:return[]}}function Um(e,t,i,s){const r=ir(e);let n=Bm(es(e),i==="start",s);return r&&(n=n.map(o=>o+"-"+r),t&&(n=n.concat(n.map($l)))),n}function An(e){const t=es(e);return Lm[t]+e.slice(t.length)}function qm(e){return{top:0,right:0,bottom:0,left:0,...e}}function tp(e){return typeof e!="number"?qm(e):{top:e,right:e,bottom:e,left:e}}function In(e){const{x:t,y:i,width:s,height:r}=e;return{width:s,height:r,top:i,left:t,right:t+s,bottom:i+r,x:t,y:i}}function rd(e,t,i){let{reference:s,floating:r}=e;const n=Pi(t),o=Zl(t),a=Jl(o),c=es(t),d=n==="y",l=s.x+s.width/2-r.width/2,u=s.y+s.height/2-r.height/2,p=s[a]/2-r[a]/2;let h;switch(c){case"top":h={x:l,y:s.y-r.height};break;case"bottom":h={x:l,y:s.y+s.height};break;case"right":h={x:s.x+s.width,y:u};break;case"left":h={x:s.x-r.width,y:u};break;default:h={x:s.x,y:s.y}}switch(ir(t)){case"start":h[o]-=p*(i&&d?-1:1);break;case"end":h[o]+=p*(i&&d?-1:1);break}return h}async function Hm(e,t){var i;t===void 0&&(t={});const{x:s,y:r,platform:n,rects:o,elements:a,strategy:c}=e,{boundary:d="clippingAncestors",rootBoundary:l="viewport",elementContext:u="floating",altBoundary:p=!1,padding:h=0}=tr(t,e),g=tp(h),m=a[p?u==="floating"?"reference":"floating":u],b=In(await n.getClippingRect({element:(i=await(n.isElement==null?void 0:n.isElement(m)))==null||i?m:m.contextElement||await(n.getDocumentElement==null?void 0:n.getDocumentElement(a.floating)),boundary:d,rootBoundary:l,strategy:c})),v=u==="floating"?{x:s,y:r,width:o.floating.width,height:o.floating.height}:o.reference,y=await(n.getOffsetParent==null?void 0:n.getOffsetParent(a.floating)),w=await(n.isElement==null?void 0:n.isElement(y))?await(n.getScale==null?void 0:n.getScale(y))||{x:1,y:1}:{x:1,y:1},C=In(n.convertOffsetParentRelativeRectToViewportRelativeRect?await n.convertOffsetParentRelativeRectToViewportRelativeRect({elements:a,rect:v,offsetParent:y,strategy:c}):v);return{top:(b.top-C.top+g.top)/w.y,bottom:(C.bottom-b.bottom+g.bottom)/w.y,left:(b.left-C.left+g.left)/w.x,right:(C.right-b.right+g.right)/w.x}}const Vm=50,jm=async(e,t,i)=>{const{placement:s="bottom",strategy:r="absolute",middleware:n=[],platform:o}=i,a=o.detectOverflow?o:{...o,detectOverflow:Hm},c=await(o.isRTL==null?void 0:o.isRTL(t));let d=await o.getElementRects({reference:e,floating:t,strategy:r}),{x:l,y:u}=rd(d,s,c),p=s,h=0;const g={};for(let f=0;f<n.length;f++){const m=n[f];if(!m)continue;const{name:b,fn:v}=m,{x:y,y:w,data:C,reset:O}=await v({x:l,y:u,initialPlacement:s,placement:p,strategy:r,middlewareData:g,rects:d,platform:a,elements:{reference:e,floating:t}});l=y??l,u=w??u,g[b]={...g[b],...C},O&&h<Vm&&(h++,typeof O=="object"&&(O.placement&&(p=O.placement),O.rects&&(d=O.rects===!0?await o.getElementRects({reference:e,floating:t,strategy:r}):O.rects),{x:l,y:u}=rd(d,p,c)),f=-1)}return{x:l,y:u,placement:p,strategy:r,middlewareData:g}},Gm=e=>({name:"arrow",options:e,async fn(t){const{x:i,y:s,placement:r,rects:n,platform:o,elements:a,middlewareData:c}=t,{element:d,padding:l=0}=tr(e,t)||{};if(d==null)return{};const u=tp(l),p={x:i,y:s},h=Zl(r),g=Jl(h),f=await o.getDimensions(d),m=h==="y",b=m?"top":"left",v=m?"bottom":"right",y=m?"clientHeight":"clientWidth",w=n.reference[g]+n.reference[h]-p[h]-n.floating[g],C=p[h]-n.reference[h],O=await(o.getOffsetParent==null?void 0:o.getOffsetParent(d));let M=O?O[y]:0;(!M||!await(o.isElement==null?void 0:o.isElement(O)))&&(M=a.floating[y]||n.floating[g]);const A=w/2-C/2,R=M/2-f[g]/2-1,D=Qi(u[b],R),F=Qi(u[v],R),P=D,S=M-f[g]-F,I=M/2-f[g]/2+A,_=Rl(P,I,S),$=!c.arrow&&ir(r)!=null&&I!==_&&n.reference[g]/2-(I<P?D:F)-f[g]/2<0,Y=$?I<P?I-P:I-S:0;return{[h]:p[h]+Y,data:{[h]:_,centerOffset:I-_-Y,...$&&{alignmentOffset:Y}},reset:$}}}),Wm=function(e){return e===void 0&&(e={}),{name:"flip",options:e,async fn(t){var i,s;const{placement:r,middlewareData:n,rects:o,initialPlacement:a,platform:c,elements:d}=t,{mainAxis:l=!0,crossAxis:u=!0,fallbackPlacements:p,fallbackStrategy:h="bestFit",fallbackAxisSideDirection:g="none",flipAlignment:f=!0,...m}=tr(e,t);if((i=n.arrow)!=null&&i.alignmentOffset)return{};const b=es(r),v=Pi(a),y=es(a)===a,w=await(c.isRTL==null?void 0:c.isRTL(d.floating)),C=p||(y||!f?[An(a)]:Mm(a)),O=g!=="none";!p&&O&&C.push(...Um(a,f,g,w));const M=[a,...C],A=await c.detectOverflow(t,m),R=[];let D=((s=n.flip)==null?void 0:s.overflows)||[];if(l&&R.push(A[b]),u){const I=Pm(r,o,w);R.push(A[I[0]],A[I[1]])}if(D=[...D,{placement:r,overflows:R}],!R.every(I=>I<=0)){var F,P;const I=(((F=n.flip)==null?void 0:F.index)||0)+1,_=M[I];if(_&&(!(u==="alignment"?v!==Pi(_):!1)||D.every(ie=>Pi(ie.placement)===v?ie.overflows[0]>0:!0)))return{data:{index:I,overflows:D},reset:{placement:_}};let $=(P=D.filter(Y=>Y.overflows[0]<=0).sort((Y,ie)=>Y.overflows[1]-ie.overflows[1])[0])==null?void 0:P.placement;if(!$)switch(h){case"bestFit":{var S;const Y=(S=D.filter(ie=>{if(O){const oe=Pi(ie.placement);return oe===v||oe==="y"}return!0}).map(ie=>[ie.placement,ie.overflows.filter(oe=>oe>0).reduce((oe,_e)=>oe+_e,0)]).sort((ie,oe)=>ie[1]-oe[1])[0])==null?void 0:S[0];Y&&($=Y);break}case"initialPlacement":$=a;break}if(r!==$)return{reset:{placement:$}}}return{}}}},Ym=new Set(["left","top"]);async function Km(e,t){const{placement:i,platform:s,elements:r}=e,n=await(s.isRTL==null?void 0:s.isRTL(r.floating)),o=es(i),a=ir(i),c=Pi(i)==="y",d=Ym.has(o)?-1:1,l=n&&c?-1:1,u=tr(t,e);let{mainAxis:p,crossAxis:h,alignmentAxis:g}=typeof u=="number"?{mainAxis:u,crossAxis:0,alignmentAxis:null}:{mainAxis:u.mainAxis||0,crossAxis:u.crossAxis||0,alignmentAxis:u.alignmentAxis};return a&&typeof g=="number"&&(h=a==="end"?g*-1:g),c?{x:h*l,y:p*d}:{x:p*d,y:h*l}}const Xm=function(e){return e===void 0&&(e=0),{name:"offset",options:e,async fn(t){var i,s;const{x:r,y:n,placement:o,middlewareData:a}=t,c=await Km(t,e);return o===((i=a.offset)==null?void 0:i.placement)&&(s=a.arrow)!=null&&s.alignmentOffset?{}:{x:r+c.x,y:n+c.y,data:{...c,placement:o}}}}},Jm=function(e){return e===void 0&&(e={}),{name:"shift",options:e,async fn(t){const{x:i,y:s,placement:r,platform:n}=t,{mainAxis:o=!0,crossAxis:a=!1,limiter:c={fn:b=>{let{x:v,y}=b;return{x:v,y}}},...d}=tr(e,t),l={x:i,y:s},u=await n.detectOverflow(t,d),p=Pi(es(r)),h=ep(p);let g=l[h],f=l[p];if(o){const b=h==="y"?"top":"left",v=h==="y"?"bottom":"right",y=g+u[b],w=g-u[v];g=Rl(y,g,w)}if(a){const b=p==="y"?"top":"left",v=p==="y"?"bottom":"right",y=f+u[b],w=f-u[v];f=Rl(y,f,w)}const m=c.fn({...t,[h]:g,[p]:f});return{...m,data:{x:m.x-i,y:m.y-s,enabled:{[h]:o,[p]:a}}}}}},Zm=function(e){return e===void 0&&(e={}),{name:"size",options:e,async fn(t){var i,s;const{placement:r,rects:n,platform:o,elements:a}=t,{apply:c=()=>{},...d}=tr(e,t),l=await o.detectOverflow(t,d),u=es(r),p=ir(r),h=Pi(r)==="y",{width:g,height:f}=n.floating;let m,b;u==="top"||u==="bottom"?(m=u,b=p===(await(o.isRTL==null?void 0:o.isRTL(a.floating))?"start":"end")?"left":"right"):(b=u,m=p==="end"?"top":"bottom");const v=f-l.top-l.bottom,y=g-l.left-l.right,w=Qi(f-l[m],v),C=Qi(g-l[b],y),O=!t.middlewareData.shift;let M=w,A=C;if((i=t.middlewareData.shift)!=null&&i.enabled.x&&(A=y),(s=t.middlewareData.shift)!=null&&s.enabled.y&&(M=v),O&&!p){const D=Ft(l.left,0),F=Ft(l.right,0),P=Ft(l.top,0),S=Ft(l.bottom,0);h?A=g-2*(D!==0||F!==0?D+F:Ft(l.left,l.right)):M=f-2*(P!==0||S!==0?P+S:Ft(l.top,l.bottom))}await c({...t,availableWidth:A,availableHeight:M});const R=await o.getDimensions(a.floating);return g!==R.width||f!==R.height?{reset:{rects:!0}}:{}}}};function Jn(){return typeof window<"u"}function sr(e){return ip(e)?(e.nodeName||"").toLowerCase():"#document"}function zt(e){var t;return(e==null||(t=e.ownerDocument)==null?void 0:t.defaultView)||window}function Si(e){var t;return(t=(ip(e)?e.ownerDocument:e.document)||window.document)==null?void 0:t.documentElement}function ip(e){return Jn()?e instanceof Node||e instanceof zt(e).Node:!1}function ii(e){return Jn()?e instanceof Element||e instanceof zt(e).Element:!1}function Hi(e){return Jn()?e instanceof HTMLElement||e instanceof zt(e).HTMLElement:!1}function nd(e){return!Jn()||typeof ShadowRoot>"u"?!1:e instanceof ShadowRoot||e instanceof zt(e).ShadowRoot}function Gr(e){const{overflow:t,overflowX:i,overflowY:s,display:r}=si(e);return/auto|scroll|overlay|hidden|clip/.test(t+s+i)&&r!=="inline"&&r!=="contents"}function Qm(e){return/^(table|td|th)$/.test(sr(e))}function Zn(e){try{if(e.matches(":popover-open"))return!0}catch{}try{return e.matches(":modal")}catch{return!1}}const eg=/transform|translate|scale|rotate|perspective|filter/,tg=/paint|layout|strict|content/,fs=e=>!!e&&e!=="none";let Ao;function Qn(e){const t=ii(e)?si(e):e;return fs(t.transform)||fs(t.translate)||fs(t.scale)||fs(t.rotate)||fs(t.perspective)||!Ql()&&(fs(t.backdropFilter)||fs(t.filter))||eg.test(t.willChange||"")||tg.test(t.contain||"")}function ig(e){let t=ts(e);for(;Hi(t)&&!Js(t);){if(Qn(t))return t;if(Zn(t))return null;t=ts(t)}return null}function Ql(){return Ao==null&&(Ao=typeof CSS<"u"&&CSS.supports&&CSS.supports("-webkit-backdrop-filter","none")),Ao}function Js(e){return/^(html|body|#document)$/.test(sr(e))}function si(e){return zt(e).getComputedStyle(e)}function eo(e){return ii(e)?{scrollLeft:e.scrollLeft,scrollTop:e.scrollTop}:{scrollLeft:e.scrollX,scrollTop:e.scrollY}}function ts(e){if(sr(e)==="html")return e;const t=e.assignedSlot||e.parentNode||nd(e)&&e.host||Si(e);return nd(t)?t.host:t}function sp(e){const t=ts(e);return Js(t)?e.ownerDocument?e.ownerDocument.body:e.body:Hi(t)&&Gr(t)?t:sp(t)}function Fr(e,t,i){var s;t===void 0&&(t=[]),i===void 0&&(i=!0);const r=sp(e),n=r===((s=e.ownerDocument)==null?void 0:s.body),o=zt(r);if(n){const a=Dl(o);return t.concat(o,o.visualViewport||[],Gr(r)?r:[],a&&i?Fr(a):[])}else return t.concat(r,Fr(r,[],i))}function Dl(e){return e.parent&&Object.getPrototypeOf(e.parent)?e.frameElement:null}function rp(e){const t=si(e);let i=parseFloat(t.width)||0,s=parseFloat(t.height)||0;const r=Hi(e),n=r?e.offsetWidth:i,o=r?e.offsetHeight:s,a=On(i)!==n||On(s)!==o;return a&&(i=n,s=o),{width:i,height:s,$:a}}function ec(e){return ii(e)?e:e.contextElement}function Ys(e){const t=ec(e);if(!Hi(t))return ki(1);const i=t.getBoundingClientRect(),{width:s,height:r,$:n}=rp(t);let o=(n?On(i.width):i.width)/s,a=(n?On(i.height):i.height)/r;return(!o||!Number.isFinite(o))&&(o=1),(!a||!Number.isFinite(a))&&(a=1),{x:o,y:a}}const sg=ki(0);function np(e){const t=zt(e);return!Ql()||!t.visualViewport?sg:{x:t.visualViewport.offsetLeft,y:t.visualViewport.offsetTop}}function rg(e,t,i){return t===void 0&&(t=!1),!i||t&&i!==zt(e)?!1:t}function ks(e,t,i,s){t===void 0&&(t=!1),i===void 0&&(i=!1);const r=e.getBoundingClientRect(),n=ec(e);let o=ki(1);t&&(s?ii(s)&&(o=Ys(s)):o=Ys(e));const a=rg(n,i,s)?np(n):ki(0);let c=(r.left+a.x)/o.x,d=(r.top+a.y)/o.y,l=r.width/o.x,u=r.height/o.y;if(n){const p=zt(n),h=s&&ii(s)?zt(s):s;let g=p,f=Dl(g);for(;f&&s&&h!==g;){const m=Ys(f),b=f.getBoundingClientRect(),v=si(f),y=b.left+(f.clientLeft+parseFloat(v.paddingLeft))*m.x,w=b.top+(f.clientTop+parseFloat(v.paddingTop))*m.y;c*=m.x,d*=m.y,l*=m.x,u*=m.y,c+=y,d+=w,g=zt(f),f=Dl(g)}}return In({width:l,height:u,x:c,y:d})}function to(e,t){const i=eo(e).scrollLeft;return t?t.left+i:ks(Si(e)).left+i}function op(e,t){const i=e.getBoundingClientRect(),s=i.left+t.scrollLeft-to(e,i),r=i.top+t.scrollTop;return{x:s,y:r}}function ng(e){let{elements:t,rect:i,offsetParent:s,strategy:r}=e;const n=r==="fixed",o=Si(s),a=t?Zn(t.floating):!1;if(s===o||a&&n)return i;let c={scrollLeft:0,scrollTop:0},d=ki(1);const l=ki(0),u=Hi(s);if((u||!u&&!n)&&((sr(s)!=="body"||Gr(o))&&(c=eo(s)),u)){const h=ks(s);d=Ys(s),l.x=h.x+s.clientLeft,l.y=h.y+s.clientTop}const p=o&&!u&&!n?op(o,c):ki(0);return{width:i.width*d.x,height:i.height*d.y,x:i.x*d.x-c.scrollLeft*d.x+l.x+p.x,y:i.y*d.y-c.scrollTop*d.y+l.y+p.y}}function og(e){return Array.from(e.getClientRects())}function ag(e){const t=Si(e),i=eo(e),s=e.ownerDocument.body,r=Ft(t.scrollWidth,t.clientWidth,s.scrollWidth,s.clientWidth),n=Ft(t.scrollHeight,t.clientHeight,s.scrollHeight,s.clientHeight);let o=-i.scrollLeft+to(e);const a=-i.scrollTop;return si(s).direction==="rtl"&&(o+=Ft(t.clientWidth,s.clientWidth)-r),{width:r,height:n,x:o,y:a}}const od=25;function lg(e,t){const i=zt(e),s=Si(e),r=i.visualViewport;let n=s.clientWidth,o=s.clientHeight,a=0,c=0;if(r){n=r.width,o=r.height;const l=Ql();(!l||l&&t==="fixed")&&(a=r.offsetLeft,c=r.offsetTop)}const d=to(s);if(d<=0){const l=s.ownerDocument,u=l.body,p=getComputedStyle(u),h=l.compatMode==="CSS1Compat"&&parseFloat(p.marginLeft)+parseFloat(p.marginRight)||0,g=Math.abs(s.clientWidth-u.clientWidth-h);g<=od&&(n-=g)}else d<=od&&(n+=d);return{width:n,height:o,x:a,y:c}}function cg(e,t){const i=ks(e,!0,t==="fixed"),s=i.top+e.clientTop,r=i.left+e.clientLeft,n=Hi(e)?Ys(e):ki(1),o=e.clientWidth*n.x,a=e.clientHeight*n.y,c=r*n.x,d=s*n.y;return{width:o,height:a,x:c,y:d}}function ad(e,t,i){let s;if(t==="viewport")s=lg(e,i);else if(t==="document")s=ag(Si(e));else if(ii(t))s=cg(t,i);else{const r=np(e);s={x:t.x-r.x,y:t.y-r.y,width:t.width,height:t.height}}return In(s)}function ap(e,t){const i=ts(e);return i===t||!ii(i)||Js(i)?!1:si(i).position==="fixed"||ap(i,t)}function dg(e,t){const i=t.get(e);if(i)return i;let s=Fr(e,[],!1).filter(a=>ii(a)&&sr(a)!=="body"),r=null;const n=si(e).position==="fixed";let o=n?ts(e):e;for(;ii(o)&&!Js(o);){const a=si(o),c=Qn(o);!c&&a.position==="fixed"&&(r=null),(n?!c&&!r:!c&&a.position==="static"&&!!r&&(r.position==="absolute"||r.position==="fixed")||Gr(o)&&!c&&ap(e,o))?s=s.filter(l=>l!==o):r=a,o=ts(o)}return t.set(e,s),s}function ug(e){let{element:t,boundary:i,rootBoundary:s,strategy:r}=e;const o=[...i==="clippingAncestors"?Zn(t)?[]:dg(t,this._c):[].concat(i),s],a=ad(t,o[0],r);let c=a.top,d=a.right,l=a.bottom,u=a.left;for(let p=1;p<o.length;p++){const h=ad(t,o[p],r);c=Ft(h.top,c),d=Qi(h.right,d),l=Qi(h.bottom,l),u=Ft(h.left,u)}return{width:d-u,height:l-c,x:u,y:c}}function hg(e){const{width:t,height:i}=rp(e);return{width:t,height:i}}function pg(e,t,i){const s=Hi(t),r=Si(t),n=i==="fixed",o=ks(e,!0,n,t);let a={scrollLeft:0,scrollTop:0};const c=ki(0);function d(){c.x=to(r)}if(s||!s&&!n)if((sr(t)!=="body"||Gr(r))&&(a=eo(t)),s){const h=ks(t,!0,n,t);c.x=h.x+t.clientLeft,c.y=h.y+t.clientTop}else r&&d();n&&!s&&r&&d();const l=r&&!s&&!n?op(r,a):ki(0),u=o.left+a.scrollLeft-c.x-l.x,p=o.top+a.scrollTop-c.y-l.y;return{x:u,y:p,width:o.width,height:o.height}}function Io(e){return si(e).position==="static"}function ld(e,t){if(!Hi(e)||si(e).position==="fixed")return null;if(t)return t(e);let i=e.offsetParent;return Si(e)===i&&(i=i.ownerDocument.body),i}function lp(e,t){const i=zt(e);if(Zn(e))return i;if(!Hi(e)){let r=ts(e);for(;r&&!Js(r);){if(ii(r)&&!Io(r))return r;r=ts(r)}return i}let s=ld(e,t);for(;s&&Qm(s)&&Io(s);)s=ld(s,t);return s&&Js(s)&&Io(s)&&!Qn(s)?i:s||ig(e)||i}const fg=async function(e){const t=this.getOffsetParent||lp,i=this.getDimensions,s=await i(e.floating);return{reference:pg(e.reference,await t(e.floating),e.strategy),floating:{x:0,y:0,width:s.width,height:s.height}}};function mg(e){return si(e).direction==="rtl"}const kn={convertOffsetParentRelativeRectToViewportRelativeRect:ng,getDocumentElement:Si,getClippingRect:ug,getOffsetParent:lp,getElementRects:fg,getClientRects:og,getDimensions:hg,getScale:Ys,isElement:ii,isRTL:mg};function cp(e,t){return e.x===t.x&&e.y===t.y&&e.width===t.width&&e.height===t.height}function gg(e,t){let i=null,s;const r=Si(e);function n(){var a;clearTimeout(s),(a=i)==null||a.disconnect(),i=null}function o(a,c){a===void 0&&(a=!1),c===void 0&&(c=1),n();const d=e.getBoundingClientRect(),{left:l,top:u,width:p,height:h}=d;if(a||t(),!p||!h)return;const g=un(u),f=un(r.clientWidth-(l+p)),m=un(r.clientHeight-(u+h)),b=un(l),y={rootMargin:-g+"px "+-f+"px "+-m+"px "+-b+"px",threshold:Ft(0,Qi(1,c))||1};let w=!0;function C(O){const M=O[0].intersectionRatio;if(M!==c){if(!w)return o();M?o(!1,M):s=setTimeout(()=>{o(!1,1e-7)},1e3)}M===1&&!cp(d,e.getBoundingClientRect())&&o(),w=!1}try{i=new IntersectionObserver(C,{...y,root:r.ownerDocument})}catch{i=new IntersectionObserver(C,y)}i.observe(e)}return o(!0),n}function bg(e,t,i,s){s===void 0&&(s={});const{ancestorScroll:r=!0,ancestorResize:n=!0,elementResize:o=typeof ResizeObserver=="function",layoutShift:a=typeof IntersectionObserver=="function",animationFrame:c=!1}=s,d=ec(e),l=r||n?[...d?Fr(d):[],...t?Fr(t):[]]:[];l.forEach(b=>{r&&b.addEventListener("scroll",i,{passive:!0}),n&&b.addEventListener("resize",i)});const u=d&&a?gg(d,i):null;let p=-1,h=null;o&&(h=new ResizeObserver(b=>{let[v]=b;v&&v.target===d&&h&&t&&(h.unobserve(t),cancelAnimationFrame(p),p=requestAnimationFrame(()=>{var y;(y=h)==null||y.observe(t)})),i()}),d&&!c&&h.observe(d),t&&h.observe(t));let g,f=c?ks(e):null;c&&m();function m(){const b=ks(e);f&&!cp(f,b)&&i(),f=b,g=requestAnimationFrame(m)}return i(),()=>{var b;l.forEach(v=>{r&&v.removeEventListener("scroll",i),n&&v.removeEventListener("resize",i)}),u==null||u(),(b=h)==null||b.disconnect(),h=null,c&&cancelAnimationFrame(g)}}const vg=Xm,yg=Jm,wg=Wm,cd=Zm,_g=Gm,kg=(e,t,i)=>{const s=new Map,r={platform:kn,...i},n={...r.platform,_c:s};return jm(e,t,{...r,platform:n})};function Eg(e){return xg(e)}function Ro(e){return e.assignedSlot?e.assignedSlot:e.parentNode instanceof ShadowRoot?e.parentNode.host:e.parentNode}function xg(e){for(let t=e;t;t=Ro(t))if(t instanceof Element&&getComputedStyle(t).display==="none")return null;for(let t=Ro(e);t;t=Ro(t)){if(!(t instanceof Element))continue;const i=getComputedStyle(t);if(i.display!=="contents"&&(i.position!=="static"||Qn(i)||t.tagName==="BODY"))return t}return null}function Tg(e){return e!==null&&typeof e=="object"&&"getBoundingClientRect"in e&&("contextElement"in e?e.contextElement instanceof Element:!0)}var Le=class extends Ae{constructor(){super(...arguments),this.localize=new Ot(this),this.active=!1,this.placement="top",this.strategy="absolute",this.distance=0,this.skidding=0,this.arrow=!1,this.arrowPlacement="anchor",this.arrowPadding=10,this.flip=!1,this.flipFallbackPlacements="",this.flipFallbackStrategy="best-fit",this.flipPadding=0,this.shift=!1,this.shiftPadding=0,this.autoSizePadding=0,this.hoverBridge=!1,this.updateHoverBridge=()=>{if(this.hoverBridge&&this.anchorEl){const e=this.anchorEl.getBoundingClientRect(),t=this.popup.getBoundingClientRect(),i=this.placement.includes("top")||this.placement.includes("bottom");let s=0,r=0,n=0,o=0,a=0,c=0,d=0,l=0;i?e.top<t.top?(s=e.left,r=e.bottom,n=e.right,o=e.bottom,a=t.left,c=t.top,d=t.right,l=t.top):(s=t.left,r=t.bottom,n=t.right,o=t.bottom,a=e.left,c=e.top,d=e.right,l=e.top):e.left<t.left?(s=e.right,r=e.top,n=t.left,o=t.top,a=e.right,c=e.bottom,d=t.left,l=t.bottom):(s=t.right,r=t.top,n=e.left,o=e.top,a=t.right,c=t.bottom,d=e.left,l=e.bottom),this.style.setProperty("--hover-bridge-top-left-x",`${s}px`),this.style.setProperty("--hover-bridge-top-left-y",`${r}px`),this.style.setProperty("--hover-bridge-top-right-x",`${n}px`),this.style.setProperty("--hover-bridge-top-right-y",`${o}px`),this.style.setProperty("--hover-bridge-bottom-left-x",`${a}px`),this.style.setProperty("--hover-bridge-bottom-left-y",`${c}px`),this.style.setProperty("--hover-bridge-bottom-right-x",`${d}px`),this.style.setProperty("--hover-bridge-bottom-right-y",`${l}px`)}}}async connectedCallback(){super.connectedCallback(),await this.updateComplete,this.start()}disconnectedCallback(){super.disconnectedCallback(),this.stop()}async updated(e){super.updated(e),e.has("active")&&(this.active?this.start():this.stop()),e.has("anchor")&&this.handleAnchorChange(),this.active&&(await this.updateComplete,this.reposition())}async handleAnchorChange(){if(await this.stop(),this.anchor&&typeof this.anchor=="string"){const e=this.getRootNode();this.anchorEl=e.getElementById(this.anchor)}else this.anchor instanceof Element||Tg(this.anchor)?this.anchorEl=this.anchor:this.anchorEl=this.querySelector('[slot="anchor"]');this.anchorEl instanceof HTMLSlotElement&&(this.anchorEl=this.anchorEl.assignedElements({flatten:!0})[0]),this.anchorEl&&this.active&&this.start()}start(){!this.anchorEl||!this.active||(this.cleanup=bg(this.anchorEl,this.popup,()=>{this.reposition()}))}async stop(){return new Promise(e=>{this.cleanup?(this.cleanup(),this.cleanup=void 0,this.removeAttribute("data-current-placement"),this.style.removeProperty("--auto-size-available-width"),this.style.removeProperty("--auto-size-available-height"),requestAnimationFrame(()=>e())):e()})}reposition(){if(!this.active||!this.anchorEl)return;const e=[vg({mainAxis:this.distance,crossAxis:this.skidding})];this.sync?e.push(cd({apply:({rects:i})=>{const s=this.sync==="width"||this.sync==="both",r=this.sync==="height"||this.sync==="both";this.popup.style.width=s?`${i.reference.width}px`:"",this.popup.style.height=r?`${i.reference.height}px`:""}})):(this.popup.style.width="",this.popup.style.height=""),this.flip&&e.push(wg({boundary:this.flipBoundary,fallbackPlacements:this.flipFallbackPlacements,fallbackStrategy:this.flipFallbackStrategy==="best-fit"?"bestFit":"initialPlacement",padding:this.flipPadding})),this.shift&&e.push(yg({boundary:this.shiftBoundary,padding:this.shiftPadding})),this.autoSize?e.push(cd({boundary:this.autoSizeBoundary,padding:this.autoSizePadding,apply:({availableWidth:i,availableHeight:s})=>{this.autoSize==="vertical"||this.autoSize==="both"?this.style.setProperty("--auto-size-available-height",`${s}px`):this.style.removeProperty("--auto-size-available-height"),this.autoSize==="horizontal"||this.autoSize==="both"?this.style.setProperty("--auto-size-available-width",`${i}px`):this.style.removeProperty("--auto-size-available-width")}})):(this.style.removeProperty("--auto-size-available-width"),this.style.removeProperty("--auto-size-available-height")),this.arrow&&e.push(_g({element:this.arrowEl,padding:this.arrowPadding}));const t=this.strategy==="absolute"?i=>kn.getOffsetParent(i,Eg):kn.getOffsetParent;kg(this.anchorEl,this.popup,{placement:this.placement,middleware:e,strategy:this.strategy,platform:qr(qi({},kn),{getOffsetParent:t})}).then(({x:i,y:s,middlewareData:r,placement:n})=>{const o=this.localize.dir()==="rtl",a={top:"bottom",right:"left",bottom:"top",left:"right"}[n.split("-")[0]];if(this.setAttribute("data-current-placement",n),Object.assign(this.popup.style,{left:`${i}px`,top:`${s}px`}),this.arrow){const c=r.arrow.x,d=r.arrow.y;let l="",u="",p="",h="";if(this.arrowPlacement==="start"){const g=typeof c=="number"?`calc(${this.arrowPadding}px - var(--arrow-padding-offset))`:"";l=typeof d=="number"?`calc(${this.arrowPadding}px - var(--arrow-padding-offset))`:"",u=o?g:"",h=o?"":g}else if(this.arrowPlacement==="end"){const g=typeof c=="number"?`calc(${this.arrowPadding}px - var(--arrow-padding-offset))`:"";u=o?"":g,h=o?g:"",p=typeof d=="number"?`calc(${this.arrowPadding}px - var(--arrow-padding-offset))`:""}else this.arrowPlacement==="center"?(h=typeof c=="number"?"calc(50% - var(--arrow-size-diagonal))":"",l=typeof d=="number"?"calc(50% - var(--arrow-size-diagonal))":""):(h=typeof c=="number"?`${c}px`:"",l=typeof d=="number"?`${d}px`:"");Object.assign(this.arrowEl.style,{top:l,right:u,bottom:p,left:h,[a]:"calc(var(--arrow-size-diagonal) * -1)"})}}),requestAnimationFrame(()=>this.updateHoverBridge()),this.emit("sl-reposition")}render(){return T`
      <slot name="anchor" @slotchange=${this.handleAnchorChange}></slot>

      <span
        part="hover-bridge"
        class=${Ce({"popup-hover-bridge":!0,"popup-hover-bridge--visible":this.hoverBridge&&this.active})}
      ></span>

      <div
        part="popup"
        class=${Ce({popup:!0,"popup--active":this.active,"popup--fixed":this.strategy==="fixed","popup--has-arrow":this.arrow})}
      >
        <slot></slot>
        ${this.arrow?T`<div part="arrow" class="popup__arrow" role="presentation"></div>`:""}
      </div>
    `}};Le.styles=[ze,Nm];E([le(".popup")],Le.prototype,"popup",2);E([le(".popup__arrow")],Le.prototype,"arrowEl",2);E([k()],Le.prototype,"anchor",2);E([k({type:Boolean,reflect:!0})],Le.prototype,"active",2);E([k({reflect:!0})],Le.prototype,"placement",2);E([k({reflect:!0})],Le.prototype,"strategy",2);E([k({type:Number})],Le.prototype,"distance",2);E([k({type:Number})],Le.prototype,"skidding",2);E([k({type:Boolean})],Le.prototype,"arrow",2);E([k({attribute:"arrow-placement"})],Le.prototype,"arrowPlacement",2);E([k({attribute:"arrow-padding",type:Number})],Le.prototype,"arrowPadding",2);E([k({type:Boolean})],Le.prototype,"flip",2);E([k({attribute:"flip-fallback-placements",converter:{fromAttribute:e=>e.split(" ").map(t=>t.trim()).filter(t=>t!==""),toAttribute:e=>e.join(" ")}})],Le.prototype,"flipFallbackPlacements",2);E([k({attribute:"flip-fallback-strategy"})],Le.prototype,"flipFallbackStrategy",2);E([k({type:Object})],Le.prototype,"flipBoundary",2);E([k({attribute:"flip-padding",type:Number})],Le.prototype,"flipPadding",2);E([k({type:Boolean})],Le.prototype,"shift",2);E([k({type:Object})],Le.prototype,"shiftBoundary",2);E([k({attribute:"shift-padding",type:Number})],Le.prototype,"shiftPadding",2);E([k({attribute:"auto-size"})],Le.prototype,"autoSize",2);E([k()],Le.prototype,"sync",2);E([k({type:Object})],Le.prototype,"autoSizeBoundary",2);E([k({attribute:"auto-size-padding",type:Number})],Le.prototype,"autoSizePadding",2);E([k({attribute:"hover-bridge",type:Boolean})],Le.prototype,"hoverBridge",2);var dp=new Map,Cg=new WeakMap;function Sg(e){return e??{keyframes:[],options:{duration:0}}}function dd(e,t){return t.toLowerCase()==="rtl"?{keyframes:e.rtlKeyframes||e.keyframes,options:e.options}:e}function At(e,t){dp.set(e,Sg(t))}function Tt(e,t,i){const s=Cg.get(e);if(s!=null&&s[t])return dd(s[t],i.dir);const r=dp.get(t);return r?dd(r,i.dir):{keyframes:[],options:{duration:0}}}function Yt(e,t){return new Promise(i=>{function s(r){r.target===e&&(e.removeEventListener(t,s),i())}e.addEventListener(t,s)})}function Ct(e,t,i){return new Promise(s=>{if((i==null?void 0:i.duration)===1/0)throw new Error("Promise-based animations must be finite.");const r=e.animate(t,qr(qi({},i),{duration:Og()?0:i.duration}));r.addEventListener("cancel",s,{once:!0}),r.addEventListener("finish",s,{once:!0})})}function ud(e){return e=e.toString().toLowerCase(),e.indexOf("ms")>-1?parseFloat(e):e.indexOf("s")>-1?parseFloat(e)*1e3:parseFloat(e)}function Og(){return window.matchMedia("(prefers-reduced-motion: reduce)").matches}function Dt(e){return Promise.all(e.getAnimations().map(t=>new Promise(i=>{t.cancel(),requestAnimationFrame(i)})))}function hd(e,t){return e.map(i=>qr(qi({},i),{height:i.height==="auto"?`${t}px`:i.height}))}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */let Nl=class extends Xn{constructor(t){if(super(t),this.it=Z,t.type!==Li.CHILD)throw Error(this.constructor.directiveName+"() can only be used in child bindings")}render(t){if(t===Z||t==null)return this._t=void 0,this.it=t;if(t===Wt)return t;if(typeof t!="string")throw Error(this.constructor.directiveName+"() called with a non-string value");if(t===this.it)return this._t;this.it=t;const i=[t];return i.raw=i,this._t={_$litType$:this.constructor.resultType,strings:i,values:[]}}};Nl.directiveName="unsafeHTML",Nl.resultType=1;const tc=Kn(Nl);var Ee=class extends Ae{constructor(){super(...arguments),this.formControlController=new jr(this,{assumeInteractionOn:["sl-blur","sl-input"]}),this.hasSlotController=new Ci(this,"help-text","label"),this.localize=new Ot(this),this.typeToSelectString="",this.hasFocus=!1,this.displayLabel="",this.selectedOptions=[],this.valueHasChanged=!1,this.name="",this._value="",this.defaultValue="",this.size="medium",this.placeholder="",this.multiple=!1,this.maxOptionsVisible=3,this.disabled=!1,this.clearable=!1,this.open=!1,this.hoist=!1,this.filled=!1,this.pill=!1,this.label="",this.placement="bottom",this.helpText="",this.form="",this.required=!1,this.getTag=e=>T`
      <sl-tag
        part="tag"
        exportparts="
              base:tag__base,
              content:tag__content,
              remove-button:tag__remove-button,
              remove-button__base:tag__remove-button__base
            "
        ?pill=${this.pill}
        size=${this.size}
        removable
        @sl-remove=${t=>this.handleTagRemove(t,e)}
      >
        ${e.getTextLabel()}
      </sl-tag>
    `,this.handleDocumentFocusIn=e=>{const t=e.composedPath();this&&!t.includes(this)&&this.hide()},this.handleDocumentKeyDown=e=>{const t=e.target,i=t.closest(".select__clear")!==null,s=t.closest("sl-icon-button")!==null;if(!(i||s)){if(e.key==="Escape"&&this.open&&!this.closeWatcher&&(e.preventDefault(),e.stopPropagation(),this.hide(),this.displayInput.focus({preventScroll:!0})),e.key==="Enter"||e.key===" "&&this.typeToSelectString===""){if(e.preventDefault(),e.stopImmediatePropagation(),!this.open){this.show();return}this.currentOption&&!this.currentOption.disabled&&(this.valueHasChanged=!0,this.multiple?this.toggleOptionSelection(this.currentOption):this.setSelectedOptions(this.currentOption),this.updateComplete.then(()=>{this.emit("sl-input"),this.emit("sl-change")}),this.multiple||(this.hide(),this.displayInput.focus({preventScroll:!0})));return}if(["ArrowUp","ArrowDown","Home","End"].includes(e.key)){const r=this.getAllOptions(),n=r.indexOf(this.currentOption);let o=Math.max(0,n);if(e.preventDefault(),!this.open&&(this.show(),this.currentOption))return;e.key==="ArrowDown"?(o=n+1,o>r.length-1&&(o=0)):e.key==="ArrowUp"?(o=n-1,o<0&&(o=r.length-1)):e.key==="Home"?o=0:e.key==="End"&&(o=r.length-1),this.setCurrentOption(r[o])}if(e.key&&e.key.length===1||e.key==="Backspace"){const r=this.getAllOptions();if(e.metaKey||e.ctrlKey||e.altKey)return;if(!this.open){if(e.key==="Backspace")return;this.show()}e.stopPropagation(),e.preventDefault(),clearTimeout(this.typeToSelectTimeout),this.typeToSelectTimeout=window.setTimeout(()=>this.typeToSelectString="",1e3),e.key==="Backspace"?this.typeToSelectString=this.typeToSelectString.slice(0,-1):this.typeToSelectString+=e.key.toLowerCase();for(const n of r)if(n.getTextLabel().toLowerCase().startsWith(this.typeToSelectString)){this.setCurrentOption(n);break}}}},this.handleDocumentMouseDown=e=>{const t=e.composedPath();this&&!t.includes(this)&&this.hide()}}get value(){return this._value}set value(e){this.multiple?e=Array.isArray(e)?e:e.split(" "):e=Array.isArray(e)?e.join(" "):e,this._value!==e&&(this.valueHasChanged=!0,this._value=e)}get validity(){return this.valueInput.validity}get validationMessage(){return this.valueInput.validationMessage}connectedCallback(){super.connectedCallback(),setTimeout(()=>{this.handleDefaultSlotChange()}),this.open=!1}addOpenListeners(){var e;document.addEventListener("focusin",this.handleDocumentFocusIn),document.addEventListener("keydown",this.handleDocumentKeyDown),document.addEventListener("mousedown",this.handleDocumentMouseDown),this.getRootNode()!==document&&this.getRootNode().addEventListener("focusin",this.handleDocumentFocusIn),"CloseWatcher"in window&&((e=this.closeWatcher)==null||e.destroy(),this.closeWatcher=new CloseWatcher,this.closeWatcher.onclose=()=>{this.open&&(this.hide(),this.displayInput.focus({preventScroll:!0}))})}removeOpenListeners(){var e;document.removeEventListener("focusin",this.handleDocumentFocusIn),document.removeEventListener("keydown",this.handleDocumentKeyDown),document.removeEventListener("mousedown",this.handleDocumentMouseDown),this.getRootNode()!==document&&this.getRootNode().removeEventListener("focusin",this.handleDocumentFocusIn),(e=this.closeWatcher)==null||e.destroy()}handleFocus(){this.hasFocus=!0,this.displayInput.setSelectionRange(0,0),this.emit("sl-focus")}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleLabelClick(){this.displayInput.focus()}handleComboboxMouseDown(e){const i=e.composedPath().some(s=>s instanceof Element&&s.tagName.toLowerCase()==="sl-icon-button");this.disabled||i||(e.preventDefault(),this.displayInput.focus({preventScroll:!0}),this.open=!this.open)}handleComboboxKeyDown(e){e.key!=="Tab"&&(e.stopPropagation(),this.handleDocumentKeyDown(e))}handleClearClick(e){e.stopPropagation(),this.valueHasChanged=!0,this.value!==""&&(this.setSelectedOptions([]),this.displayInput.focus({preventScroll:!0}),this.updateComplete.then(()=>{this.emit("sl-clear"),this.emit("sl-input"),this.emit("sl-change")}))}handleClearMouseDown(e){e.stopPropagation(),e.preventDefault()}handleOptionClick(e){const i=e.target.closest("sl-option"),s=this.value;i&&!i.disabled&&(this.valueHasChanged=!0,this.multiple?this.toggleOptionSelection(i):this.setSelectedOptions(i),this.updateComplete.then(()=>this.displayInput.focus({preventScroll:!0})),this.value!==s&&this.updateComplete.then(()=>{this.emit("sl-input"),this.emit("sl-change")}),this.multiple||(this.hide(),this.displayInput.focus({preventScroll:!0})))}handleDefaultSlotChange(){customElements.get("sl-option")||customElements.whenDefined("sl-option").then(()=>this.handleDefaultSlotChange());const e=this.getAllOptions(),t=this.valueHasChanged?this.value:this.defaultValue,i=Array.isArray(t)?t:[t],s=[];e.forEach(r=>s.push(r.value)),this.setSelectedOptions(e.filter(r=>i.includes(r.value)))}handleTagRemove(e,t){e.stopPropagation(),this.valueHasChanged=!0,this.disabled||(this.toggleOptionSelection(t,!1),this.updateComplete.then(()=>{this.emit("sl-input"),this.emit("sl-change")}))}getAllOptions(){return[...this.querySelectorAll("sl-option")]}getFirstOption(){return this.querySelector("sl-option")}setCurrentOption(e){this.getAllOptions().forEach(i=>{i.current=!1,i.tabIndex=-1}),e&&(this.currentOption=e,e.current=!0,e.tabIndex=0,e.focus())}setSelectedOptions(e){const t=this.getAllOptions(),i=Array.isArray(e)?e:[e];t.forEach(s=>s.selected=!1),i.length&&i.forEach(s=>s.selected=!0),this.selectionChanged()}toggleOptionSelection(e,t){t===!0||t===!1?e.selected=t:e.selected=!e.selected,this.selectionChanged()}selectionChanged(){var e,t,i;const s=this.getAllOptions();this.selectedOptions=s.filter(n=>n.selected);const r=this.valueHasChanged;if(this.multiple)this.value=this.selectedOptions.map(n=>n.value),this.placeholder&&this.value.length===0?this.displayLabel="":this.displayLabel=this.localize.term("numOptionsSelected",this.selectedOptions.length);else{const n=this.selectedOptions[0];this.value=(e=n==null?void 0:n.value)!=null?e:"",this.displayLabel=(i=(t=n==null?void 0:n.getTextLabel)==null?void 0:t.call(n))!=null?i:""}this.valueHasChanged=r,this.updateComplete.then(()=>{this.formControlController.updateValidity()})}get tags(){return this.selectedOptions.map((e,t)=>{if(t<this.maxOptionsVisible||this.maxOptionsVisible<=0){const i=this.getTag(e,t);return T`<div @sl-remove=${s=>this.handleTagRemove(s,e)}>
          ${typeof i=="string"?tc(i):i}
        </div>`}else if(t===this.maxOptionsVisible)return T`<sl-tag size=${this.size}>+${this.selectedOptions.length-t}</sl-tag>`;return T``})}handleInvalid(e){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(e)}handleDisabledChange(){this.disabled&&(this.open=!1,this.handleOpenChange())}attributeChangedCallback(e,t,i){if(super.attributeChangedCallback(e,t,i),e==="value"){const s=this.valueHasChanged;this.value=this.defaultValue,this.valueHasChanged=s}}handleValueChange(){if(!this.valueHasChanged){const i=this.valueHasChanged;this.value=this.defaultValue,this.valueHasChanged=i}const e=this.getAllOptions(),t=Array.isArray(this.value)?this.value:[this.value];this.setSelectedOptions(e.filter(i=>t.includes(i.value)))}async handleOpenChange(){if(this.open&&!this.disabled){this.setCurrentOption(this.selectedOptions[0]||this.getFirstOption()),this.emit("sl-show"),this.addOpenListeners(),await Dt(this),this.listbox.hidden=!1,this.popup.active=!0,requestAnimationFrame(()=>{this.setCurrentOption(this.currentOption)});const{keyframes:e,options:t}=Tt(this,"select.show",{dir:this.localize.dir()});await Ct(this.popup.popup,e,t),this.currentOption&&Il(this.currentOption,this.listbox,"vertical","auto"),this.emit("sl-after-show")}else{this.emit("sl-hide"),this.removeOpenListeners(),await Dt(this);const{keyframes:e,options:t}=Tt(this,"select.hide",{dir:this.localize.dir()});await Ct(this.popup.popup,e,t),this.listbox.hidden=!0,this.popup.active=!1,this.emit("sl-after-hide")}}async show(){if(this.open||this.disabled){this.open=!1;return}return this.open=!0,Yt(this,"sl-after-show")}async hide(){if(!this.open||this.disabled){this.open=!1;return}return this.open=!1,Yt(this,"sl-after-hide")}checkValidity(){return this.valueInput.checkValidity()}getForm(){return this.formControlController.getForm()}reportValidity(){return this.valueInput.reportValidity()}setCustomValidity(e){this.valueInput.setCustomValidity(e),this.formControlController.updateValidity()}focus(e){this.displayInput.focus(e)}blur(){this.displayInput.blur()}render(){const e=this.hasSlotController.test("label"),t=this.hasSlotController.test("help-text"),i=this.label?!0:!!e,s=this.helpText?!0:!!t,r=this.clearable&&!this.disabled&&this.value.length>0,n=this.placeholder&&this.value&&this.value.length<=0;return T`
      <div
        part="form-control"
        class=${Ce({"form-control":!0,"form-control--small":this.size==="small","form-control--medium":this.size==="medium","form-control--large":this.size==="large","form-control--has-label":i,"form-control--has-help-text":s})}
      >
        <label
          id="label"
          part="form-control-label"
          class="form-control__label"
          aria-hidden=${i?"false":"true"}
          @click=${this.handleLabelClick}
        >
          <slot name="label">${this.label}</slot>
        </label>

        <div part="form-control-input" class="form-control-input">
          <sl-popup
            class=${Ce({select:!0,"select--standard":!0,"select--filled":this.filled,"select--pill":this.pill,"select--open":this.open,"select--disabled":this.disabled,"select--multiple":this.multiple,"select--focused":this.hasFocus,"select--placeholder-visible":n,"select--top":this.placement==="top","select--bottom":this.placement==="bottom","select--small":this.size==="small","select--medium":this.size==="medium","select--large":this.size==="large"})}
            placement=${this.placement}
            strategy=${this.hoist?"fixed":"absolute"}
            flip
            shift
            sync="width"
            auto-size="vertical"
            auto-size-padding="10"
          >
            <div
              part="combobox"
              class="select__combobox"
              slot="anchor"
              @keydown=${this.handleComboboxKeyDown}
              @mousedown=${this.handleComboboxMouseDown}
            >
              <slot part="prefix" name="prefix" class="select__prefix"></slot>

              <input
                part="display-input"
                class="select__display-input"
                type="text"
                placeholder=${this.placeholder}
                .disabled=${this.disabled}
                .value=${this.displayLabel}
                autocomplete="off"
                spellcheck="false"
                autocapitalize="off"
                readonly
                aria-controls="listbox"
                aria-expanded=${this.open?"true":"false"}
                aria-haspopup="listbox"
                aria-labelledby="label"
                aria-disabled=${this.disabled?"true":"false"}
                aria-describedby="help-text"
                role="combobox"
                tabindex="0"
                @focus=${this.handleFocus}
                @blur=${this.handleBlur}
              />

              ${this.multiple?T`<div part="tags" class="select__tags">${this.tags}</div>`:""}

              <input
                class="select__value-input"
                type="text"
                ?disabled=${this.disabled}
                ?required=${this.required}
                .value=${Array.isArray(this.value)?this.value.join(", "):this.value}
                tabindex="-1"
                aria-hidden="true"
                @focus=${()=>this.focus()}
                @invalid=${this.handleInvalid}
              />

              ${r?T`
                    <button
                      part="clear-button"
                      class="select__clear"
                      type="button"
                      aria-label=${this.localize.term("clearEntry")}
                      @mousedown=${this.handleClearMouseDown}
                      @click=${this.handleClearClick}
                      tabindex="-1"
                    >
                      <slot name="clear-icon">
                        <sl-icon name="x-circle-fill" library="system"></sl-icon>
                      </slot>
                    </button>
                  `:""}

              <slot name="suffix" part="suffix" class="select__suffix"></slot>

              <slot name="expand-icon" part="expand-icon" class="select__expand-icon">
                <sl-icon library="system" name="chevron-down"></sl-icon>
              </slot>
            </div>

            <div
              id="listbox"
              role="listbox"
              aria-expanded=${this.open?"true":"false"}
              aria-multiselectable=${this.multiple?"true":"false"}
              aria-labelledby="label"
              part="listbox"
              class="select__listbox"
              tabindex="-1"
              @mouseup=${this.handleOptionClick}
              @slotchange=${this.handleDefaultSlotChange}
            >
              <slot></slot>
            </div>
          </sl-popup>
        </div>

        <div
          part="form-control-help-text"
          id="help-text"
          class="form-control__help-text"
          aria-hidden=${s?"false":"true"}
        >
          <slot name="help-text">${this.helpText}</slot>
        </div>
      </div>
    `}};Ee.styles=[ze,Wn,Im];Ee.dependencies={"sl-icon":pt,"sl-popup":Le,"sl-tag":as};E([le(".select")],Ee.prototype,"popup",2);E([le(".select__combobox")],Ee.prototype,"combobox",2);E([le(".select__display-input")],Ee.prototype,"displayInput",2);E([le(".select__value-input")],Ee.prototype,"valueInput",2);E([le(".select__listbox")],Ee.prototype,"listbox",2);E([U()],Ee.prototype,"hasFocus",2);E([U()],Ee.prototype,"displayLabel",2);E([U()],Ee.prototype,"currentOption",2);E([U()],Ee.prototype,"selectedOptions",2);E([U()],Ee.prototype,"valueHasChanged",2);E([k()],Ee.prototype,"name",2);E([U()],Ee.prototype,"value",1);E([k({attribute:"value"})],Ee.prototype,"defaultValue",2);E([k({reflect:!0})],Ee.prototype,"size",2);E([k()],Ee.prototype,"placeholder",2);E([k({type:Boolean,reflect:!0})],Ee.prototype,"multiple",2);E([k({attribute:"max-options-visible",type:Number})],Ee.prototype,"maxOptionsVisible",2);E([k({type:Boolean,reflect:!0})],Ee.prototype,"disabled",2);E([k({type:Boolean})],Ee.prototype,"clearable",2);E([k({type:Boolean,reflect:!0})],Ee.prototype,"open",2);E([k({type:Boolean})],Ee.prototype,"hoist",2);E([k({type:Boolean,reflect:!0})],Ee.prototype,"filled",2);E([k({type:Boolean,reflect:!0})],Ee.prototype,"pill",2);E([k()],Ee.prototype,"label",2);E([k({reflect:!0})],Ee.prototype,"placement",2);E([k({attribute:"help-text"})],Ee.prototype,"helpText",2);E([k({reflect:!0})],Ee.prototype,"form",2);E([k({type:Boolean,reflect:!0})],Ee.prototype,"required",2);E([k()],Ee.prototype,"getTag",2);E([we("disabled",{waitUntilFirstUpdate:!0})],Ee.prototype,"handleDisabledChange",1);E([we(["defaultValue","value"],{waitUntilFirstUpdate:!0})],Ee.prototype,"handleValueChange",1);E([we("open",{waitUntilFirstUpdate:!0})],Ee.prototype,"handleOpenChange",1);At("select.show",{keyframes:[{opacity:0,scale:.9},{opacity:1,scale:1}],options:{duration:100,easing:"ease"}});At("select.hide",{keyframes:[{opacity:1,scale:1},{opacity:0,scale:.9}],options:{duration:100,easing:"ease"}});Ee.define("sl-select");var Ag=ee`
  :host {
    display: block;
    user-select: none;
    -webkit-user-select: none;
  }

  :host(:focus) {
    outline: none;
  }

  .option {
    position: relative;
    display: flex;
    align-items: center;
    font-family: var(--sl-font-sans);
    font-size: var(--sl-font-size-medium);
    font-weight: var(--sl-font-weight-normal);
    line-height: var(--sl-line-height-normal);
    letter-spacing: var(--sl-letter-spacing-normal);
    color: var(--sl-color-neutral-700);
    padding: var(--sl-spacing-x-small) var(--sl-spacing-medium) var(--sl-spacing-x-small) var(--sl-spacing-x-small);
    transition: var(--sl-transition-fast) fill;
    cursor: pointer;
  }

  .option--hover:not(.option--current):not(.option--disabled) {
    background-color: var(--sl-color-neutral-100);
    color: var(--sl-color-neutral-1000);
  }

  .option--current,
  .option--current.option--disabled {
    background-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
    opacity: 1;
  }

  .option--disabled {
    outline: none;
    opacity: 0.5;
    cursor: not-allowed;
  }

  .option__label {
    flex: 1 1 auto;
    display: inline-block;
    line-height: var(--sl-line-height-dense);
  }

  .option .option__check {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    visibility: hidden;
    padding-inline-end: var(--sl-spacing-2x-small);
  }

  .option--selected .option__check {
    visibility: visible;
  }

  .option__prefix,
  .option__suffix {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
  }

  .option__prefix::slotted(*) {
    margin-inline-end: var(--sl-spacing-x-small);
  }

  .option__suffix::slotted(*) {
    margin-inline-start: var(--sl-spacing-x-small);
  }

  @media (forced-colors: active) {
    :host(:hover:not([aria-disabled='true'])) .option {
      outline: dashed 1px SelectedItem;
      outline-offset: -1px;
    }
  }
`,Jt=class extends Ae{constructor(){super(...arguments),this.localize=new Ot(this),this.isInitialized=!1,this.current=!1,this.selected=!1,this.hasHover=!1,this.value="",this.disabled=!1}connectedCallback(){super.connectedCallback(),this.setAttribute("role","option"),this.setAttribute("aria-selected","false")}handleDefaultSlotChange(){this.isInitialized?customElements.whenDefined("sl-select").then(()=>{const e=this.closest("sl-select");e&&e.handleDefaultSlotChange()}):this.isInitialized=!0}handleMouseEnter(){this.hasHover=!0}handleMouseLeave(){this.hasHover=!1}handleDisabledChange(){this.setAttribute("aria-disabled",this.disabled?"true":"false")}handleSelectedChange(){this.setAttribute("aria-selected",this.selected?"true":"false")}handleValueChange(){typeof this.value!="string"&&(this.value=String(this.value)),this.value.includes(" ")&&(console.error("Option values cannot include a space. All spaces have been replaced with underscores.",this),this.value=this.value.replace(/ /g,"_"))}getTextLabel(){const e=this.childNodes;let t="";return[...e].forEach(i=>{i.nodeType===Node.ELEMENT_NODE&&(i.hasAttribute("slot")||(t+=i.textContent)),i.nodeType===Node.TEXT_NODE&&(t+=i.textContent)}),t.trim()}render(){return T`
      <div
        part="base"
        class=${Ce({option:!0,"option--current":this.current,"option--disabled":this.disabled,"option--selected":this.selected,"option--hover":this.hasHover})}
        @mouseenter=${this.handleMouseEnter}
        @mouseleave=${this.handleMouseLeave}
      >
        <sl-icon part="checked-icon" class="option__check" name="check" library="system" aria-hidden="true"></sl-icon>
        <slot part="prefix" name="prefix" class="option__prefix"></slot>
        <slot part="label" class="option__label" @slotchange=${this.handleDefaultSlotChange}></slot>
        <slot part="suffix" name="suffix" class="option__suffix"></slot>
      </div>
    `}};Jt.styles=[ze,Ag];Jt.dependencies={"sl-icon":pt};E([le(".option__label")],Jt.prototype,"defaultSlot",2);E([U()],Jt.prototype,"current",2);E([U()],Jt.prototype,"selected",2);E([U()],Jt.prototype,"hasHover",2);E([k({reflect:!0})],Jt.prototype,"value",2);E([k({type:Boolean,reflect:!0})],Jt.prototype,"disabled",2);E([we("disabled")],Jt.prototype,"handleDisabledChange",1);E([we("selected")],Jt.prototype,"handleSelectedChange",1);E([we("value")],Jt.prototype,"handleValueChange",1);Jt.define("sl-option");var Pe=class extends Ae{constructor(){super(...arguments),this.formControlController=new jr(this,{assumeInteractionOn:["click"]}),this.hasSlotController=new Ci(this,"[default]","prefix","suffix"),this.localize=new Ot(this),this.hasFocus=!1,this.invalid=!1,this.title="",this.variant="default",this.size="medium",this.caret=!1,this.disabled=!1,this.loading=!1,this.outline=!1,this.pill=!1,this.circle=!1,this.type="button",this.name="",this.value="",this.href="",this.rel="noreferrer noopener"}get validity(){return this.isButton()?this.button.validity:Yn}get validationMessage(){return this.isButton()?this.button.validationMessage:""}firstUpdated(){this.isButton()&&this.formControlController.updateValidity()}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleClick(){this.type==="submit"&&this.formControlController.submit(this),this.type==="reset"&&this.formControlController.reset(this)}handleInvalid(e){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(e)}isButton(){return!this.href}isLink(){return!!this.href}handleDisabledChange(){this.isButton()&&this.formControlController.setValidity(this.disabled)}click(){this.button.click()}focus(e){this.button.focus(e)}blur(){this.button.blur()}checkValidity(){return this.isButton()?this.button.checkValidity():!0}getForm(){return this.formControlController.getForm()}reportValidity(){return this.isButton()?this.button.reportValidity():!0}setCustomValidity(e){this.isButton()&&(this.button.setCustomValidity(e),this.formControlController.updateValidity())}render(){const e=this.isLink(),t=e?Sn`a`:Sn`button`;return Ir`
      <${t}
        part="base"
        class=${Ce({button:!0,"button--default":this.variant==="default","button--primary":this.variant==="primary","button--success":this.variant==="success","button--neutral":this.variant==="neutral","button--warning":this.variant==="warning","button--danger":this.variant==="danger","button--text":this.variant==="text","button--small":this.size==="small","button--medium":this.size==="medium","button--large":this.size==="large","button--caret":this.caret,"button--circle":this.circle,"button--disabled":this.disabled,"button--focused":this.hasFocus,"button--loading":this.loading,"button--standard":!this.outline,"button--outline":this.outline,"button--pill":this.pill,"button--rtl":this.localize.dir()==="rtl","button--has-label":this.hasSlotController.test("[default]"),"button--has-prefix":this.hasSlotController.test("prefix"),"button--has-suffix":this.hasSlotController.test("suffix")})}
        ?disabled=${pe(e?void 0:this.disabled)}
        type=${pe(e?void 0:this.type)}
        title=${this.title}
        name=${pe(e?void 0:this.name)}
        value=${pe(e?void 0:this.value)}
        href=${pe(e&&!this.disabled?this.href:void 0)}
        target=${pe(e?this.target:void 0)}
        download=${pe(e?this.download:void 0)}
        rel=${pe(e?this.rel:void 0)}
        role=${pe(e?void 0:"button")}
        aria-disabled=${this.disabled?"true":"false"}
        tabindex=${this.disabled?"-1":"0"}
        @blur=${this.handleBlur}
        @focus=${this.handleFocus}
        @invalid=${this.isButton()?this.handleInvalid:null}
        @click=${this.handleClick}
      >
        <slot name="prefix" part="prefix" class="button__prefix"></slot>
        <slot part="label" class="button__label"></slot>
        <slot name="suffix" part="suffix" class="button__suffix"></slot>
        ${this.caret?Ir` <sl-icon part="caret" class="button__caret" library="system" name="caret"></sl-icon> `:""}
        ${this.loading?Ir`<sl-spinner part="spinner"></sl-spinner>`:""}
      </${t}>
    `}};Pe.styles=[ze,Jh];Pe.dependencies={"sl-icon":pt,"sl-spinner":Gn};E([le(".button")],Pe.prototype,"button",2);E([U()],Pe.prototype,"hasFocus",2);E([U()],Pe.prototype,"invalid",2);E([k()],Pe.prototype,"title",2);E([k({reflect:!0})],Pe.prototype,"variant",2);E([k({reflect:!0})],Pe.prototype,"size",2);E([k({type:Boolean,reflect:!0})],Pe.prototype,"caret",2);E([k({type:Boolean,reflect:!0})],Pe.prototype,"disabled",2);E([k({type:Boolean,reflect:!0})],Pe.prototype,"loading",2);E([k({type:Boolean,reflect:!0})],Pe.prototype,"outline",2);E([k({type:Boolean,reflect:!0})],Pe.prototype,"pill",2);E([k({type:Boolean,reflect:!0})],Pe.prototype,"circle",2);E([k()],Pe.prototype,"type",2);E([k()],Pe.prototype,"name",2);E([k()],Pe.prototype,"value",2);E([k()],Pe.prototype,"href",2);E([k()],Pe.prototype,"target",2);E([k()],Pe.prototype,"rel",2);E([k()],Pe.prototype,"download",2);E([k()],Pe.prototype,"form",2);E([k({attribute:"formaction"})],Pe.prototype,"formAction",2);E([k({attribute:"formenctype"})],Pe.prototype,"formEnctype",2);E([k({attribute:"formmethod"})],Pe.prototype,"formMethod",2);E([k({attribute:"formnovalidate",type:Boolean})],Pe.prototype,"formNoValidate",2);E([k({attribute:"formtarget"})],Pe.prototype,"formTarget",2);E([we("disabled",{waitUntilFirstUpdate:!0})],Pe.prototype,"handleDisabledChange",1);Pe.define("sl-button");var Ig=ee`
  :host {
    --border-color: var(--sl-color-neutral-200);
    --border-radius: var(--sl-border-radius-medium);
    --border-width: 1px;
    --padding: var(--sl-spacing-large);

    display: inline-block;
  }

  .card {
    display: flex;
    flex-direction: column;
    background-color: var(--sl-panel-background-color);
    box-shadow: var(--sl-shadow-x-small);
    border: solid var(--border-width) var(--border-color);
    border-radius: var(--border-radius);
  }

  .card__image {
    display: flex;
    border-top-left-radius: var(--border-radius);
    border-top-right-radius: var(--border-radius);
    margin: calc(-1 * var(--border-width));
    overflow: hidden;
  }

  .card__image::slotted(img) {
    display: block;
    width: 100%;
  }

  .card:not(.card--has-image) .card__image {
    display: none;
  }

  .card__header {
    display: block;
    border-bottom: solid var(--border-width) var(--border-color);
    padding: calc(var(--padding) / 2) var(--padding);
  }

  .card:not(.card--has-header) .card__header {
    display: none;
  }

  .card:not(.card--has-image) .card__header {
    border-top-left-radius: var(--border-radius);
    border-top-right-radius: var(--border-radius);
  }

  .card__body {
    display: block;
    padding: var(--padding);
  }

  .card--has-footer .card__footer {
    display: block;
    border-top: solid var(--border-width) var(--border-color);
    padding: var(--padding);
  }

  .card:not(.card--has-footer) .card__footer {
    display: none;
  }
`,up=class extends Ae{constructor(){super(...arguments),this.hasSlotController=new Ci(this,"footer","header","image")}render(){return T`
      <div
        part="base"
        class=${Ce({card:!0,"card--has-footer":this.hasSlotController.test("footer"),"card--has-image":this.hasSlotController.test("image"),"card--has-header":this.hasSlotController.test("header")})}
      >
        <slot name="image" part="image" class="card__image"></slot>
        <slot name="header" part="header" class="card__header"></slot>
        <slot part="body" class="card__body"></slot>
        <slot name="footer" part="footer" class="card__footer"></slot>
      </div>
    `}};up.styles=[ze,Ig];up.define("sl-card");var Rg=ee`
  :host {
    display: inline-flex;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: max(12px, 0.75em);
    font-weight: var(--sl-font-weight-semibold);
    letter-spacing: var(--sl-letter-spacing-normal);
    line-height: 1;
    border-radius: var(--sl-border-radius-small);
    border: solid 1px var(--sl-color-neutral-0);
    white-space: nowrap;
    padding: 0.35em 0.6em;
    user-select: none;
    -webkit-user-select: none;
    cursor: inherit;
  }

  /* Variant modifiers */
  .badge--primary {
    background-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
  }

  .badge--success {
    background-color: var(--sl-color-success-600);
    color: var(--sl-color-neutral-0);
  }

  .badge--neutral {
    background-color: var(--sl-color-neutral-600);
    color: var(--sl-color-neutral-0);
  }

  .badge--warning {
    background-color: var(--sl-color-warning-600);
    color: var(--sl-color-neutral-0);
  }

  .badge--danger {
    background-color: var(--sl-color-danger-600);
    color: var(--sl-color-neutral-0);
  }

  /* Pill modifier */
  .badge--pill {
    border-radius: var(--sl-border-radius-pill);
  }

  /* Pulse modifier */
  .badge--pulse {
    animation: pulse 1.5s infinite;
  }

  .badge--pulse.badge--primary {
    --pulse-color: var(--sl-color-primary-600);
  }

  .badge--pulse.badge--success {
    --pulse-color: var(--sl-color-success-600);
  }

  .badge--pulse.badge--neutral {
    --pulse-color: var(--sl-color-neutral-600);
  }

  .badge--pulse.badge--warning {
    --pulse-color: var(--sl-color-warning-600);
  }

  .badge--pulse.badge--danger {
    --pulse-color: var(--sl-color-danger-600);
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 var(--pulse-color);
    }
    70% {
      box-shadow: 0 0 0 0.5rem transparent;
    }
    100% {
      box-shadow: 0 0 0 0 transparent;
    }
  }
`,Wr=class extends Ae{constructor(){super(...arguments),this.variant="primary",this.pill=!1,this.pulse=!1}render(){return T`
      <span
        part="base"
        class=${Ce({badge:!0,"badge--primary":this.variant==="primary","badge--success":this.variant==="success","badge--neutral":this.variant==="neutral","badge--warning":this.variant==="warning","badge--danger":this.variant==="danger","badge--pill":this.pill,"badge--pulse":this.pulse})}
        role="status"
      >
        <slot></slot>
      </span>
    `}};Wr.styles=[ze,Rg];E([k({reflect:!0})],Wr.prototype,"variant",2);E([k({type:Boolean,reflect:!0})],Wr.prototype,"pill",2);E([k({type:Boolean,reflect:!0})],Wr.prototype,"pulse",2);Wr.define("sl-badge");as.define("sl-tag");var $g=ee`
  :host {
    display: inline-block;

    --size: 3rem;
  }

  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    width: var(--size);
    height: var(--size);
    background-color: var(--sl-color-neutral-400);
    font-family: var(--sl-font-sans);
    font-size: calc(var(--size) * 0.5);
    font-weight: var(--sl-font-weight-normal);
    color: var(--sl-color-neutral-0);
    user-select: none;
    -webkit-user-select: none;
    vertical-align: middle;
  }

  .avatar--circle,
  .avatar--circle .avatar__image {
    border-radius: var(--sl-border-radius-circle);
  }

  .avatar--rounded,
  .avatar--rounded .avatar__image {
    border-radius: var(--sl-border-radius-medium);
  }

  .avatar--square {
    border-radius: 0;
  }

  .avatar__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .avatar__initials {
    line-height: 1;
    text-transform: uppercase;
  }

  .avatar__image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    overflow: hidden;
  }
`,Oi=class extends Ae{constructor(){super(...arguments),this.hasError=!1,this.image="",this.label="",this.initials="",this.loading="eager",this.shape="circle"}handleImageChange(){this.hasError=!1}handleImageLoadError(){this.hasError=!0,this.emit("sl-error")}render(){const e=T`
      <img
        part="image"
        class="avatar__image"
        src="${this.image}"
        loading="${this.loading}"
        alt=""
        @error="${this.handleImageLoadError}"
      />
    `;let t=T``;return this.initials?t=T`<div part="initials" class="avatar__initials">${this.initials}</div>`:t=T`
        <div part="icon" class="avatar__icon" aria-hidden="true">
          <slot name="icon">
            <sl-icon name="person-fill" library="system"></sl-icon>
          </slot>
        </div>
      `,T`
      <div
        part="base"
        class=${Ce({avatar:!0,"avatar--circle":this.shape==="circle","avatar--rounded":this.shape==="rounded","avatar--square":this.shape==="square"})}
        role="img"
        aria-label=${this.label}
      >
        ${this.image&&!this.hasError?e:t}
      </div>
    `}};Oi.styles=[ze,$g];Oi.dependencies={"sl-icon":pt};E([U()],Oi.prototype,"hasError",2);E([k()],Oi.prototype,"image",2);E([k()],Oi.prototype,"label",2);E([k()],Oi.prototype,"initials",2);E([k()],Oi.prototype,"loading",2);E([k({reflect:!0})],Oi.prototype,"shape",2);E([we("image")],Oi.prototype,"handleImageChange",1);Oi.define("sl-avatar");pt.define("sl-icon");at.define("sl-icon-button");var hp=e=>{var t;const{activeElement:i}=document;i&&e.contains(i)&&((t=document.activeElement)==null||t.blur())},Dg=ee`
  :host {
    display: contents;

    /* For better DX, we'll reset the margin here so the base part can inherit it */
    margin: 0;
  }

  .alert {
    position: relative;
    display: flex;
    align-items: stretch;
    background-color: var(--sl-panel-background-color);
    border: solid var(--sl-panel-border-width) var(--sl-panel-border-color);
    border-top-width: calc(var(--sl-panel-border-width) * 3);
    border-radius: var(--sl-border-radius-medium);
    font-family: var(--sl-font-sans);
    font-size: var(--sl-font-size-small);
    font-weight: var(--sl-font-weight-normal);
    line-height: 1.6;
    color: var(--sl-color-neutral-700);
    margin: inherit;
    overflow: hidden;
  }

  .alert:not(.alert--has-icon) .alert__icon,
  .alert:not(.alert--closable) .alert__close-button {
    display: none;
  }

  .alert__icon {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    font-size: var(--sl-font-size-large);
    padding-inline-start: var(--sl-spacing-large);
  }

  .alert--has-countdown {
    border-bottom: none;
  }

  .alert--primary {
    border-top-color: var(--sl-color-primary-600);
  }

  .alert--primary .alert__icon {
    color: var(--sl-color-primary-600);
  }

  .alert--success {
    border-top-color: var(--sl-color-success-600);
  }

  .alert--success .alert__icon {
    color: var(--sl-color-success-600);
  }

  .alert--neutral {
    border-top-color: var(--sl-color-neutral-600);
  }

  .alert--neutral .alert__icon {
    color: var(--sl-color-neutral-600);
  }

  .alert--warning {
    border-top-color: var(--sl-color-warning-600);
  }

  .alert--warning .alert__icon {
    color: var(--sl-color-warning-600);
  }

  .alert--danger {
    border-top-color: var(--sl-color-danger-600);
  }

  .alert--danger .alert__icon {
    color: var(--sl-color-danger-600);
  }

  .alert__message {
    flex: 1 1 auto;
    display: block;
    padding: var(--sl-spacing-large);
    overflow: hidden;
  }

  .alert__close-button {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    font-size: var(--sl-font-size-medium);
    margin-inline-end: var(--sl-spacing-medium);
    align-self: center;
  }

  .alert__countdown {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: calc(var(--sl-panel-border-width) * 3);
    background-color: var(--sl-panel-border-color);
    display: flex;
  }

  .alert__countdown--ltr {
    justify-content: flex-end;
  }

  .alert__countdown .alert__countdown-elapsed {
    height: 100%;
    width: 0;
  }

  .alert--primary .alert__countdown-elapsed {
    background-color: var(--sl-color-primary-600);
  }

  .alert--success .alert__countdown-elapsed {
    background-color: var(--sl-color-success-600);
  }

  .alert--neutral .alert__countdown-elapsed {
    background-color: var(--sl-color-neutral-600);
  }

  .alert--warning .alert__countdown-elapsed {
    background-color: var(--sl-color-warning-600);
  }

  .alert--danger .alert__countdown-elapsed {
    background-color: var(--sl-color-danger-600);
  }

  .alert__timer {
    display: none;
  }
`,Vt=class gs extends Ae{constructor(){super(...arguments),this.hasSlotController=new Ci(this,"icon","suffix"),this.localize=new Ot(this),this.open=!1,this.closable=!1,this.variant="primary",this.duration=1/0,this.remainingTime=this.duration}static get toastStack(){return this.currentToastStack||(this.currentToastStack=Object.assign(document.createElement("div"),{className:"sl-toast-stack"})),this.currentToastStack}firstUpdated(){this.base.hidden=!this.open}restartAutoHide(){this.handleCountdownChange(),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval),this.open&&this.duration<1/0&&(this.autoHideTimeout=window.setTimeout(()=>this.hide(),this.duration),this.remainingTime=this.duration,this.remainingTimeInterval=window.setInterval(()=>{this.remainingTime-=100},100))}pauseAutoHide(){var t;(t=this.countdownAnimation)==null||t.pause(),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval)}resumeAutoHide(){var t;this.duration<1/0&&(this.autoHideTimeout=window.setTimeout(()=>this.hide(),this.remainingTime),this.remainingTimeInterval=window.setInterval(()=>{this.remainingTime-=100},100),(t=this.countdownAnimation)==null||t.play())}handleCountdownChange(){if(this.open&&this.duration<1/0&&this.countdown){const{countdownElement:t}=this,i="100%",s="0";this.countdownAnimation=t.animate([{width:i},{width:s}],{duration:this.duration,easing:"linear"})}}handleCloseClick(){this.hide()}async handleOpenChange(){if(this.open){this.emit("sl-show"),this.duration<1/0&&this.restartAutoHide(),await Dt(this.base),this.base.hidden=!1;const{keyframes:t,options:i}=Tt(this,"alert.show",{dir:this.localize.dir()});await Ct(this.base,t,i),this.emit("sl-after-show")}else{hp(this),this.emit("sl-hide"),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval),await Dt(this.base);const{keyframes:t,options:i}=Tt(this,"alert.hide",{dir:this.localize.dir()});await Ct(this.base,t,i),this.base.hidden=!0,this.emit("sl-after-hide")}}handleDurationChange(){this.restartAutoHide()}async show(){if(!this.open)return this.open=!0,Yt(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,Yt(this,"sl-after-hide")}async toast(){return new Promise(t=>{this.handleCountdownChange(),gs.toastStack.parentElement===null&&document.body.append(gs.toastStack),gs.toastStack.appendChild(this),requestAnimationFrame(()=>{this.clientWidth,this.show()}),this.addEventListener("sl-after-hide",()=>{gs.toastStack.removeChild(this),t(),gs.toastStack.querySelector("sl-alert")===null&&gs.toastStack.remove()},{once:!0})})}render(){return T`
      <div
        part="base"
        class=${Ce({alert:!0,"alert--open":this.open,"alert--closable":this.closable,"alert--has-countdown":!!this.countdown,"alert--has-icon":this.hasSlotController.test("icon"),"alert--primary":this.variant==="primary","alert--success":this.variant==="success","alert--neutral":this.variant==="neutral","alert--warning":this.variant==="warning","alert--danger":this.variant==="danger"})}
        role="alert"
        aria-hidden=${this.open?"false":"true"}
        @mouseenter=${this.pauseAutoHide}
        @mouseleave=${this.resumeAutoHide}
      >
        <div part="icon" class="alert__icon">
          <slot name="icon"></slot>
        </div>

        <div part="message" class="alert__message" aria-live="polite">
          <slot></slot>
        </div>

        ${this.closable?T`
              <sl-icon-button
                part="close-button"
                exportparts="base:close-button__base"
                class="alert__close-button"
                name="x-lg"
                library="system"
                label=${this.localize.term("close")}
                @click=${this.handleCloseClick}
              ></sl-icon-button>
            `:""}

        <div role="timer" class="alert__timer">${this.remainingTime}</div>

        ${this.countdown?T`
              <div
                class=${Ce({alert__countdown:!0,"alert__countdown--ltr":this.countdown==="ltr"})}
              >
                <div class="alert__countdown-elapsed"></div>
              </div>
            `:""}
      </div>
    `}};Vt.styles=[ze,Dg];Vt.dependencies={"sl-icon-button":at};E([le('[part~="base"]')],Vt.prototype,"base",2);E([le(".alert__countdown-elapsed")],Vt.prototype,"countdownElement",2);E([k({type:Boolean,reflect:!0})],Vt.prototype,"open",2);E([k({type:Boolean,reflect:!0})],Vt.prototype,"closable",2);E([k({reflect:!0})],Vt.prototype,"variant",2);E([k({type:Number})],Vt.prototype,"duration",2);E([k({type:String,reflect:!0})],Vt.prototype,"countdown",2);E([U()],Vt.prototype,"remainingTime",2);E([we("open",{waitUntilFirstUpdate:!0})],Vt.prototype,"handleOpenChange",1);E([we("duration")],Vt.prototype,"handleDurationChange",1);var Ng=Vt;At("alert.show",{keyframes:[{opacity:0,scale:.8},{opacity:1,scale:1}],options:{duration:250,easing:"ease"}});At("alert.hide",{keyframes:[{opacity:1,scale:1},{opacity:0,scale:.8}],options:{duration:250,easing:"ease"}});Ng.define("sl-alert");var Lg=ee`
  :host {
    --color: var(--sl-panel-border-color);
    --width: var(--sl-panel-border-width);
    --spacing: var(--sl-spacing-medium);
  }

  :host(:not([vertical])) {
    display: block;
    border-top: solid var(--width) var(--color);
    margin: var(--spacing) 0;
  }

  :host([vertical]) {
    display: inline-block;
    height: 100%;
    border-left: solid var(--width) var(--color);
    margin: 0 var(--spacing);
  }
`,io=class extends Ae{constructor(){super(...arguments),this.vertical=!1}connectedCallback(){super.connectedCallback(),this.setAttribute("role","separator")}handleVerticalChange(){this.setAttribute("aria-orientation",this.vertical?"vertical":"horizontal")}};io.styles=[ze,Lg];E([k({type:Boolean,reflect:!0})],io.prototype,"vertical",2);E([we("vertical")],io.prototype,"handleVerticalChange",1);io.define("sl-divider");var Pg=ee`
  :host {
    display: block;
  }

  .details {
    border: solid 1px var(--sl-color-neutral-200);
    border-radius: var(--sl-border-radius-medium);
    background-color: var(--sl-color-neutral-0);
    overflow-anchor: none;
  }

  .details--disabled {
    opacity: 0.5;
  }

  .details__header {
    display: flex;
    align-items: center;
    border-radius: inherit;
    padding: var(--sl-spacing-medium);
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;
  }

  .details__header::-webkit-details-marker {
    display: none;
  }

  .details__header:focus {
    outline: none;
  }

  .details__header:focus-visible {
    outline: var(--sl-focus-ring);
    outline-offset: calc(1px + var(--sl-focus-ring-offset));
  }

  .details--disabled .details__header {
    cursor: not-allowed;
  }

  .details--disabled .details__header:focus-visible {
    outline: none;
    box-shadow: none;
  }

  .details__summary {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
  }

  .details__summary-icon {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    transition: var(--sl-transition-medium) rotate ease;
  }

  .details--open .details__summary-icon {
    rotate: 90deg;
  }

  .details--open.details--rtl .details__summary-icon {
    rotate: -90deg;
  }

  .details--open slot[name='expand-icon'],
  .details:not(.details--open) slot[name='collapse-icon'] {
    display: none;
  }

  .details__body {
    overflow: hidden;
  }

  .details__content {
    display: block;
    padding: var(--sl-spacing-medium);
  }
`,oi=class extends Ae{constructor(){super(...arguments),this.localize=new Ot(this),this.open=!1,this.disabled=!1}firstUpdated(){this.body.style.height=this.open?"auto":"0",this.open&&(this.details.open=!0),this.detailsObserver=new MutationObserver(e=>{for(const t of e)t.type==="attributes"&&t.attributeName==="open"&&(this.details.open?this.show():this.hide())}),this.detailsObserver.observe(this.details,{attributes:!0})}disconnectedCallback(){var e;super.disconnectedCallback(),(e=this.detailsObserver)==null||e.disconnect()}handleSummaryClick(e){e.preventDefault(),this.disabled||(this.open?this.hide():this.show(),this.header.focus())}handleSummaryKeyDown(e){(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),this.open?this.hide():this.show()),(e.key==="ArrowUp"||e.key==="ArrowLeft")&&(e.preventDefault(),this.hide()),(e.key==="ArrowDown"||e.key==="ArrowRight")&&(e.preventDefault(),this.show())}async handleOpenChange(){if(this.open){if(this.details.open=!0,this.emit("sl-show",{cancelable:!0}).defaultPrevented){this.open=!1,this.details.open=!1;return}await Dt(this.body);const{keyframes:t,options:i}=Tt(this,"details.show",{dir:this.localize.dir()});await Ct(this.body,hd(t,this.body.scrollHeight),i),this.body.style.height="auto",this.emit("sl-after-show")}else{if(this.emit("sl-hide",{cancelable:!0}).defaultPrevented){this.details.open=!0,this.open=!0;return}await Dt(this.body);const{keyframes:t,options:i}=Tt(this,"details.hide",{dir:this.localize.dir()});await Ct(this.body,hd(t,this.body.scrollHeight),i),this.body.style.height="auto",this.details.open=!1,this.emit("sl-after-hide")}}async show(){if(!(this.open||this.disabled))return this.open=!0,Yt(this,"sl-after-show")}async hide(){if(!(!this.open||this.disabled))return this.open=!1,Yt(this,"sl-after-hide")}render(){const e=this.localize.dir()==="rtl";return T`
      <details
        part="base"
        class=${Ce({details:!0,"details--open":this.open,"details--disabled":this.disabled,"details--rtl":e})}
      >
        <summary
          part="header"
          id="header"
          class="details__header"
          role="button"
          aria-expanded=${this.open?"true":"false"}
          aria-controls="content"
          aria-disabled=${this.disabled?"true":"false"}
          tabindex=${this.disabled?"-1":"0"}
          @click=${this.handleSummaryClick}
          @keydown=${this.handleSummaryKeyDown}
        >
          <slot name="summary" part="summary" class="details__summary">${this.summary}</slot>

          <span part="summary-icon" class="details__summary-icon">
            <slot name="expand-icon">
              <sl-icon library="system" name=${e?"chevron-left":"chevron-right"}></sl-icon>
            </slot>
            <slot name="collapse-icon">
              <sl-icon library="system" name=${e?"chevron-left":"chevron-right"}></sl-icon>
            </slot>
          </span>
        </summary>

        <div class="details__body" role="region" aria-labelledby="header">
          <slot part="content" id="content" class="details__content"></slot>
        </div>
      </details>
    `}};oi.styles=[ze,Pg];oi.dependencies={"sl-icon":pt};E([le(".details")],oi.prototype,"details",2);E([le(".details__header")],oi.prototype,"header",2);E([le(".details__body")],oi.prototype,"body",2);E([le(".details__expand-icon-slot")],oi.prototype,"expandIconSlot",2);E([k({type:Boolean,reflect:!0})],oi.prototype,"open",2);E([k()],oi.prototype,"summary",2);E([k({type:Boolean,reflect:!0})],oi.prototype,"disabled",2);E([we("open",{waitUntilFirstUpdate:!0})],oi.prototype,"handleOpenChange",1);At("details.show",{keyframes:[{height:"0",opacity:"0"},{height:"auto",opacity:"1"}],options:{duration:250,easing:"linear"}});At("details.hide",{keyframes:[{height:"auto",opacity:"1"},{height:"0",opacity:"0"}],options:{duration:250,easing:"linear"}});oi.define("sl-details");function*ic(e=document.activeElement){e!=null&&(yield e,"shadowRoot"in e&&e.shadowRoot&&e.shadowRoot.mode!=="closed"&&(yield*Mf(ic(e.shadowRoot.activeElement))))}function pp(){return[...ic()].pop()}var pd=new WeakMap;function fp(e){let t=pd.get(e);return t||(t=window.getComputedStyle(e,null),pd.set(e,t)),t}function Mg(e){if(typeof e.checkVisibility=="function")return e.checkVisibility({checkOpacity:!1,checkVisibilityCSS:!0});const t=fp(e);return t.visibility!=="hidden"&&t.display!=="none"}function Fg(e){const t=fp(e),{overflowY:i,overflowX:s}=t;return i==="scroll"||s==="scroll"?!0:i!=="auto"||s!=="auto"?!1:e.scrollHeight>e.clientHeight&&i==="auto"||e.scrollWidth>e.clientWidth&&s==="auto"}function zg(e){const t=e.tagName.toLowerCase(),i=Number(e.getAttribute("tabindex"));if(e.hasAttribute("tabindex")&&(isNaN(i)||i<=-1)||e.hasAttribute("disabled")||e.closest("[inert]"))return!1;if(t==="input"&&e.getAttribute("type")==="radio"){const n=e.getRootNode(),o=`input[type='radio'][name="${e.getAttribute("name")}"]`,a=n.querySelector(`${o}:checked`);return a?a===e:n.querySelector(o)===e}return Mg(e)?(t==="audio"||t==="video")&&e.hasAttribute("controls")||e.hasAttribute("tabindex")||e.hasAttribute("contenteditable")&&e.getAttribute("contenteditable")!=="false"||["button","input","select","textarea","a","audio","video","summary","iframe"].includes(t)?!0:Fg(e):!1}function Bg(e){var t,i;const s=Ll(e),r=(t=s[0])!=null?t:null,n=(i=s[s.length-1])!=null?i:null;return{start:r,end:n}}function Ug(e,t){var i;return((i=e.getRootNode({composed:!0}))==null?void 0:i.host)!==t}function Ll(e){const t=new WeakMap,i=[];function s(r){if(r instanceof Element){if(r.hasAttribute("inert")||r.closest("[inert]")||t.has(r))return;t.set(r,!0),!i.includes(r)&&zg(r)&&i.push(r),r instanceof HTMLSlotElement&&Ug(r,e)&&r.assignedElements({flatten:!0}).forEach(n=>{s(n)}),r.shadowRoot!==null&&r.shadowRoot.mode==="open"&&s(r.shadowRoot)}for(const n of r.children)s(n)}return s(e),i.sort((r,n)=>{const o=Number(r.getAttribute("tabindex"))||0;return(Number(n.getAttribute("tabindex"))||0)-o})}var yr=[],qg=class{constructor(e){this.tabDirection="forward",this.handleFocusIn=()=>{this.isActive()&&this.checkFocus()},this.handleKeyDown=t=>{var i;if(t.key!=="Tab"||this.isExternalActivated||!this.isActive())return;const s=pp();if(this.previousFocus=s,this.previousFocus&&this.possiblyHasTabbableChildren(this.previousFocus))return;t.shiftKey?this.tabDirection="backward":this.tabDirection="forward";const r=Ll(this.element);let n=r.findIndex(a=>a===s);this.previousFocus=this.currentFocus;const o=this.tabDirection==="forward"?1:-1;for(;;){n+o>=r.length?n=0:n+o<0?n=r.length-1:n+=o,this.previousFocus=this.currentFocus;const a=r[n];if(this.tabDirection==="backward"&&this.previousFocus&&this.possiblyHasTabbableChildren(this.previousFocus)||a&&this.possiblyHasTabbableChildren(a))return;t.preventDefault(),this.currentFocus=a,(i=this.currentFocus)==null||i.focus({preventScroll:!1});const c=[...ic()];if(c.includes(this.currentFocus)||!c.includes(this.previousFocus))break}setTimeout(()=>this.checkFocus())},this.handleKeyUp=()=>{this.tabDirection="forward"},this.element=e,this.elementsWithTabbableControls=["iframe"]}activate(){yr.push(this.element),document.addEventListener("focusin",this.handleFocusIn),document.addEventListener("keydown",this.handleKeyDown),document.addEventListener("keyup",this.handleKeyUp)}deactivate(){yr=yr.filter(e=>e!==this.element),this.currentFocus=null,document.removeEventListener("focusin",this.handleFocusIn),document.removeEventListener("keydown",this.handleKeyDown),document.removeEventListener("keyup",this.handleKeyUp)}isActive(){return yr[yr.length-1]===this.element}activateExternal(){this.isExternalActivated=!0}deactivateExternal(){this.isExternalActivated=!1}checkFocus(){if(this.isActive()&&!this.isExternalActivated){const e=Ll(this.element);if(!this.element.matches(":focus-within")){const t=e[0],i=e[e.length-1],s=this.tabDirection==="forward"?t:i;typeof(s==null?void 0:s.focus)=="function"&&(this.currentFocus=s,s.focus({preventScroll:!1}))}}}possiblyHasTabbableChildren(e){return this.elementsWithTabbableControls.includes(e.tagName.toLowerCase())||e.hasAttribute("controls")}},Hg=ee`
  :host {
    --width: 31rem;
    --header-spacing: var(--sl-spacing-large);
    --body-spacing: var(--sl-spacing-large);
    --footer-spacing: var(--sl-spacing-large);

    display: contents;
  }

  .dialog {
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: var(--sl-z-index-dialog);
  }

  .dialog__panel {
    display: flex;
    flex-direction: column;
    z-index: 2;
    width: var(--width);
    max-width: calc(100% - var(--sl-spacing-2x-large));
    max-height: calc(100% - var(--sl-spacing-2x-large));
    background-color: var(--sl-panel-background-color);
    border-radius: var(--sl-border-radius-medium);
    box-shadow: var(--sl-shadow-x-large);
  }

  .dialog__panel:focus {
    outline: none;
  }

  /* Ensure there's enough vertical padding for phones that don't update vh when chrome appears (e.g. iPhone) */
  @media screen and (max-width: 420px) {
    .dialog__panel {
      max-height: 80vh;
    }
  }

  .dialog--open .dialog__panel {
    display: flex;
    opacity: 1;
  }

  .dialog__header {
    flex: 0 0 auto;
    display: flex;
  }

  .dialog__title {
    flex: 1 1 auto;
    font: inherit;
    font-size: var(--sl-font-size-large);
    line-height: var(--sl-line-height-dense);
    padding: var(--header-spacing);
    margin: 0;
  }

  .dialog__header-actions {
    flex-shrink: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: end;
    gap: var(--sl-spacing-2x-small);
    padding: 0 var(--header-spacing);
  }

  .dialog__header-actions sl-icon-button,
  .dialog__header-actions ::slotted(sl-icon-button) {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    font-size: var(--sl-font-size-medium);
  }

  .dialog__body {
    flex: 1 1 auto;
    display: block;
    padding: var(--body-spacing);
    overflow: auto;
    -webkit-overflow-scrolling: touch;
  }

  .dialog__footer {
    flex: 0 0 auto;
    text-align: right;
    padding: var(--footer-spacing);
  }

  .dialog__footer ::slotted(sl-button:not(:first-of-type)) {
    margin-inline-start: var(--sl-spacing-x-small);
  }

  .dialog:not(.dialog--has-footer) .dialog__footer {
    display: none;
  }

  .dialog__overlay {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background-color: var(--sl-overlay-background-color);
  }

  @media (forced-colors: active) {
    .dialog__panel {
      border: solid 1px var(--sl-color-neutral-0);
    }
  }
`,Ai=class extends Ae{constructor(){super(...arguments),this.hasSlotController=new Ci(this,"footer"),this.localize=new Ot(this),this.modal=new qg(this),this.open=!1,this.label="",this.noHeader=!1,this.handleDocumentKeyDown=e=>{e.key==="Escape"&&this.modal.isActive()&&this.open&&(e.stopPropagation(),this.requestClose("keyboard"))}}firstUpdated(){this.dialog.hidden=!this.open,this.open&&(this.addOpenListeners(),this.modal.activate(),ed(this))}disconnectedCallback(){super.disconnectedCallback(),this.modal.deactivate(),td(this),this.removeOpenListeners()}requestClose(e){if(this.emit("sl-request-close",{cancelable:!0,detail:{source:e}}).defaultPrevented){const i=Tt(this,"dialog.denyClose",{dir:this.localize.dir()});Ct(this.panel,i.keyframes,i.options);return}this.hide()}addOpenListeners(){var e;"CloseWatcher"in window?((e=this.closeWatcher)==null||e.destroy(),this.closeWatcher=new CloseWatcher,this.closeWatcher.onclose=()=>this.requestClose("keyboard")):document.addEventListener("keydown",this.handleDocumentKeyDown)}removeOpenListeners(){var e;(e=this.closeWatcher)==null||e.destroy(),document.removeEventListener("keydown",this.handleDocumentKeyDown)}async handleOpenChange(){if(this.open){this.emit("sl-show"),this.addOpenListeners(),this.originalTrigger=document.activeElement,this.modal.activate(),ed(this);const e=this.querySelector("[autofocus]");e&&e.removeAttribute("autofocus"),await Promise.all([Dt(this.dialog),Dt(this.overlay)]),this.dialog.hidden=!1,requestAnimationFrame(()=>{this.emit("sl-initial-focus",{cancelable:!0}).defaultPrevented||(e?e.focus({preventScroll:!0}):this.panel.focus({preventScroll:!0})),e&&e.setAttribute("autofocus","")});const t=Tt(this,"dialog.show",{dir:this.localize.dir()}),i=Tt(this,"dialog.overlay.show",{dir:this.localize.dir()});await Promise.all([Ct(this.panel,t.keyframes,t.options),Ct(this.overlay,i.keyframes,i.options)]),this.emit("sl-after-show")}else{hp(this),this.emit("sl-hide"),this.removeOpenListeners(),this.modal.deactivate(),await Promise.all([Dt(this.dialog),Dt(this.overlay)]);const e=Tt(this,"dialog.hide",{dir:this.localize.dir()}),t=Tt(this,"dialog.overlay.hide",{dir:this.localize.dir()});await Promise.all([Ct(this.overlay,t.keyframes,t.options).then(()=>{this.overlay.hidden=!0}),Ct(this.panel,e.keyframes,e.options).then(()=>{this.panel.hidden=!0})]),this.dialog.hidden=!0,this.overlay.hidden=!1,this.panel.hidden=!1,td(this);const i=this.originalTrigger;typeof(i==null?void 0:i.focus)=="function"&&setTimeout(()=>i.focus()),this.emit("sl-after-hide")}}async show(){if(!this.open)return this.open=!0,Yt(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,Yt(this,"sl-after-hide")}render(){return T`
      <div
        part="base"
        class=${Ce({dialog:!0,"dialog--open":this.open,"dialog--has-footer":this.hasSlotController.test("footer")})}
      >
        <div part="overlay" class="dialog__overlay" @click=${()=>this.requestClose("overlay")} tabindex="-1"></div>

        <div
          part="panel"
          class="dialog__panel"
          role="dialog"
          aria-modal="true"
          aria-hidden=${this.open?"false":"true"}
          aria-label=${pe(this.noHeader?this.label:void 0)}
          aria-labelledby=${pe(this.noHeader?void 0:"title")}
          tabindex="-1"
        >
          ${this.noHeader?"":T`
                <header part="header" class="dialog__header">
                  <h2 part="title" class="dialog__title" id="title">
                    <slot name="label"> ${this.label.length>0?this.label:"\uFEFF"} </slot>
                  </h2>
                  <div part="header-actions" class="dialog__header-actions">
                    <slot name="header-actions"></slot>
                    <sl-icon-button
                      part="close-button"
                      exportparts="base:close-button__base"
                      class="dialog__close"
                      name="x-lg"
                      label=${this.localize.term("close")}
                      library="system"
                      @click="${()=>this.requestClose("close-button")}"
                    ></sl-icon-button>
                  </div>
                </header>
              `}
          ${""}
          <div part="body" class="dialog__body" tabindex="-1"><slot></slot></div>

          <footer part="footer" class="dialog__footer">
            <slot name="footer"></slot>
          </footer>
        </div>
      </div>
    `}};Ai.styles=[ze,Hg];Ai.dependencies={"sl-icon-button":at};E([le(".dialog")],Ai.prototype,"dialog",2);E([le(".dialog__panel")],Ai.prototype,"panel",2);E([le(".dialog__overlay")],Ai.prototype,"overlay",2);E([k({type:Boolean,reflect:!0})],Ai.prototype,"open",2);E([k({reflect:!0})],Ai.prototype,"label",2);E([k({attribute:"no-header",type:Boolean,reflect:!0})],Ai.prototype,"noHeader",2);E([we("open",{waitUntilFirstUpdate:!0})],Ai.prototype,"handleOpenChange",1);At("dialog.show",{keyframes:[{opacity:0,scale:.8},{opacity:1,scale:1}],options:{duration:250,easing:"ease"}});At("dialog.hide",{keyframes:[{opacity:1,scale:1},{opacity:0,scale:.8}],options:{duration:250,easing:"ease"}});At("dialog.denyClose",{keyframes:[{scale:1},{scale:1.02},{scale:1}],options:{duration:250}});At("dialog.overlay.show",{keyframes:[{opacity:0},{opacity:1}],options:{duration:250}});At("dialog.overlay.hide",{keyframes:[{opacity:1},{opacity:0}],options:{duration:250}});Ai.define("sl-dialog");var Vg=ee`
  :host {
    display: block;
  }

  .input {
    flex: 1 1 auto;
    display: inline-flex;
    align-items: stretch;
    justify-content: start;
    position: relative;
    width: 100%;
    font-family: var(--sl-input-font-family);
    font-weight: var(--sl-input-font-weight);
    letter-spacing: var(--sl-input-letter-spacing);
    vertical-align: middle;
    overflow: hidden;
    cursor: text;
    transition:
      var(--sl-transition-fast) color,
      var(--sl-transition-fast) border,
      var(--sl-transition-fast) box-shadow,
      var(--sl-transition-fast) background-color;
  }

  /* Standard inputs */
  .input--standard {
    background-color: var(--sl-input-background-color);
    border: solid var(--sl-input-border-width) var(--sl-input-border-color);
  }

  .input--standard:hover:not(.input--disabled) {
    background-color: var(--sl-input-background-color-hover);
    border-color: var(--sl-input-border-color-hover);
  }

  .input--standard.input--focused:not(.input--disabled) {
    background-color: var(--sl-input-background-color-focus);
    border-color: var(--sl-input-border-color-focus);
    box-shadow: 0 0 0 var(--sl-focus-ring-width) var(--sl-input-focus-ring-color);
  }

  .input--standard.input--focused:not(.input--disabled) .input__control {
    color: var(--sl-input-color-focus);
  }

  .input--standard.input--disabled {
    background-color: var(--sl-input-background-color-disabled);
    border-color: var(--sl-input-border-color-disabled);
    opacity: 0.5;
    cursor: not-allowed;
  }

  .input--standard.input--disabled .input__control {
    color: var(--sl-input-color-disabled);
  }

  .input--standard.input--disabled .input__control::placeholder {
    color: var(--sl-input-placeholder-color-disabled);
  }

  /* Filled inputs */
  .input--filled {
    border: none;
    background-color: var(--sl-input-filled-background-color);
    color: var(--sl-input-color);
  }

  .input--filled:hover:not(.input--disabled) {
    background-color: var(--sl-input-filled-background-color-hover);
  }

  .input--filled.input--focused:not(.input--disabled) {
    background-color: var(--sl-input-filled-background-color-focus);
    outline: var(--sl-focus-ring);
    outline-offset: var(--sl-focus-ring-offset);
  }

  .input--filled.input--disabled {
    background-color: var(--sl-input-filled-background-color-disabled);
    opacity: 0.5;
    cursor: not-allowed;
  }

  .input__control {
    flex: 1 1 auto;
    font-family: inherit;
    font-size: inherit;
    font-weight: inherit;
    min-width: 0;
    height: 100%;
    color: var(--sl-input-color);
    border: none;
    background: inherit;
    box-shadow: none;
    padding: 0;
    margin: 0;
    cursor: inherit;
    -webkit-appearance: none;
  }

  .input__control::-webkit-search-decoration,
  .input__control::-webkit-search-cancel-button,
  .input__control::-webkit-search-results-button,
  .input__control::-webkit-search-results-decoration {
    -webkit-appearance: none;
  }

  .input__control:-webkit-autofill,
  .input__control:-webkit-autofill:hover,
  .input__control:-webkit-autofill:focus,
  .input__control:-webkit-autofill:active {
    box-shadow: 0 0 0 var(--sl-input-height-large) var(--sl-input-background-color-hover) inset !important;
    -webkit-text-fill-color: var(--sl-color-primary-500);
    caret-color: var(--sl-input-color);
  }

  .input--filled .input__control:-webkit-autofill,
  .input--filled .input__control:-webkit-autofill:hover,
  .input--filled .input__control:-webkit-autofill:focus,
  .input--filled .input__control:-webkit-autofill:active {
    box-shadow: 0 0 0 var(--sl-input-height-large) var(--sl-input-filled-background-color) inset !important;
  }

  .input__control::placeholder {
    color: var(--sl-input-placeholder-color);
    user-select: none;
    -webkit-user-select: none;
  }

  .input:hover:not(.input--disabled) .input__control {
    color: var(--sl-input-color-hover);
  }

  .input__control:focus {
    outline: none;
  }

  .input__prefix,
  .input__suffix {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    cursor: default;
  }

  .input__prefix ::slotted(sl-icon),
  .input__suffix ::slotted(sl-icon) {
    color: var(--sl-input-icon-color);
  }

  /*
   * Size modifiers
   */

  .input--small {
    border-radius: var(--sl-input-border-radius-small);
    font-size: var(--sl-input-font-size-small);
    height: var(--sl-input-height-small);
  }

  .input--small .input__control {
    height: calc(var(--sl-input-height-small) - var(--sl-input-border-width) * 2);
    padding: 0 var(--sl-input-spacing-small);
  }

  .input--small .input__clear,
  .input--small .input__password-toggle {
    width: calc(1em + var(--sl-input-spacing-small) * 2);
  }

  .input--small .input__prefix ::slotted(*) {
    margin-inline-start: var(--sl-input-spacing-small);
  }

  .input--small .input__suffix ::slotted(*) {
    margin-inline-end: var(--sl-input-spacing-small);
  }

  .input--medium {
    border-radius: var(--sl-input-border-radius-medium);
    font-size: var(--sl-input-font-size-medium);
    height: var(--sl-input-height-medium);
  }

  .input--medium .input__control {
    height: calc(var(--sl-input-height-medium) - var(--sl-input-border-width) * 2);
    padding: 0 var(--sl-input-spacing-medium);
  }

  .input--medium .input__clear,
  .input--medium .input__password-toggle {
    width: calc(1em + var(--sl-input-spacing-medium) * 2);
  }

  .input--medium .input__prefix ::slotted(*) {
    margin-inline-start: var(--sl-input-spacing-medium);
  }

  .input--medium .input__suffix ::slotted(*) {
    margin-inline-end: var(--sl-input-spacing-medium);
  }

  .input--large {
    border-radius: var(--sl-input-border-radius-large);
    font-size: var(--sl-input-font-size-large);
    height: var(--sl-input-height-large);
  }

  .input--large .input__control {
    height: calc(var(--sl-input-height-large) - var(--sl-input-border-width) * 2);
    padding: 0 var(--sl-input-spacing-large);
  }

  .input--large .input__clear,
  .input--large .input__password-toggle {
    width: calc(1em + var(--sl-input-spacing-large) * 2);
  }

  .input--large .input__prefix ::slotted(*) {
    margin-inline-start: var(--sl-input-spacing-large);
  }

  .input--large .input__suffix ::slotted(*) {
    margin-inline-end: var(--sl-input-spacing-large);
  }

  /*
   * Pill modifier
   */

  .input--pill.input--small {
    border-radius: var(--sl-input-height-small);
  }

  .input--pill.input--medium {
    border-radius: var(--sl-input-height-medium);
  }

  .input--pill.input--large {
    border-radius: var(--sl-input-height-large);
  }

  /*
   * Clearable + Password Toggle
   */

  .input__clear,
  .input__password-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: inherit;
    color: var(--sl-input-icon-color);
    border: none;
    background: none;
    padding: 0;
    transition: var(--sl-transition-fast) color;
    cursor: pointer;
  }

  .input__clear:hover,
  .input__password-toggle:hover {
    color: var(--sl-input-icon-color-hover);
  }

  .input__clear:focus,
  .input__password-toggle:focus {
    outline: none;
  }

  /* Don't show the browser's password toggle in Edge */
  ::-ms-reveal {
    display: none;
  }

  /* Hide the built-in number spinner */
  .input--no-spin-buttons input[type='number']::-webkit-outer-spin-button,
  .input--no-spin-buttons input[type='number']::-webkit-inner-spin-button {
    -webkit-appearance: none;
    display: none;
  }

  .input--no-spin-buttons input[type='number'] {
    -moz-appearance: textfield;
  }
`,mp=(e="value")=>(t,i)=>{const s=t.constructor,r=s.prototype.attributeChangedCallback;s.prototype.attributeChangedCallback=function(n,o,a){var c;const d=s.getPropertyOptions(e),l=typeof d.attribute=="string"?d.attribute:e;if(n===l){const u=d.converter||Ks,h=(typeof u=="function"?u:(c=u==null?void 0:u.fromAttribute)!=null?c:Ks.fromAttribute)(a,d.type);this[e]!==h&&(this[i]=h)}r.call(this,n,o,a)}};/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const gp=Kn(class extends Xn{constructor(e){if(super(e),e.type!==Li.PROPERTY&&e.type!==Li.ATTRIBUTE&&e.type!==Li.BOOLEAN_ATTRIBUTE)throw Error("The `live` directive is not allowed on child or event bindings");if(!Qh(e))throw Error("`live` bindings can only contain a single expression")}render(e){return e}update(e,[t]){if(t===Wt||t===Z)return t;const i=e.element,s=e.name;if(e.type===Li.PROPERTY){if(t===i[s])return Wt}else if(e.type===Li.BOOLEAN_ATTRIBUTE){if(!!t===i.hasAttribute(s))return Wt}else if(e.type===Li.ATTRIBUTE&&i.getAttribute(s)===t+"")return Wt;return Am(e),t}});var be=class extends Ae{constructor(){super(...arguments),this.formControlController=new jr(this,{assumeInteractionOn:["sl-blur","sl-input"]}),this.hasSlotController=new Ci(this,"help-text","label"),this.localize=new Ot(this),this.hasFocus=!1,this.title="",this.__numberInput=Object.assign(document.createElement("input"),{type:"number"}),this.__dateInput=Object.assign(document.createElement("input"),{type:"date"}),this.type="text",this.name="",this.value="",this.defaultValue="",this.size="medium",this.filled=!1,this.pill=!1,this.label="",this.helpText="",this.clearable=!1,this.disabled=!1,this.placeholder="",this.readonly=!1,this.passwordToggle=!1,this.passwordVisible=!1,this.noSpinButtons=!1,this.form="",this.required=!1,this.spellcheck=!0}get valueAsDate(){var e;return this.__dateInput.type=this.type,this.__dateInput.value=this.value,((e=this.input)==null?void 0:e.valueAsDate)||this.__dateInput.valueAsDate}set valueAsDate(e){this.__dateInput.type=this.type,this.__dateInput.valueAsDate=e,this.value=this.__dateInput.value}get valueAsNumber(){var e;return this.__numberInput.value=this.value,((e=this.input)==null?void 0:e.valueAsNumber)||this.__numberInput.valueAsNumber}set valueAsNumber(e){this.__numberInput.valueAsNumber=e,this.value=this.__numberInput.value}get validity(){return this.input.validity}get validationMessage(){return this.input.validationMessage}firstUpdated(){this.formControlController.updateValidity()}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleChange(){this.value=this.input.value,this.emit("sl-change")}handleClearClick(e){e.preventDefault(),this.value!==""&&(this.value="",this.emit("sl-clear"),this.emit("sl-input"),this.emit("sl-change")),this.input.focus()}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleInput(){this.value=this.input.value,this.formControlController.updateValidity(),this.emit("sl-input")}handleInvalid(e){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(e)}handleKeyDown(e){const t=e.metaKey||e.ctrlKey||e.shiftKey||e.altKey;e.key==="Enter"&&!t&&setTimeout(()=>{!e.defaultPrevented&&!e.isComposing&&this.formControlController.submit()})}handlePasswordToggle(){this.passwordVisible=!this.passwordVisible}handleDisabledChange(){this.formControlController.setValidity(this.disabled)}handleStepChange(){this.input.step=String(this.step),this.formControlController.updateValidity()}async handleValueChange(){await this.updateComplete,this.formControlController.updateValidity()}focus(e){this.input.focus(e)}blur(){this.input.blur()}select(){this.input.select()}setSelectionRange(e,t,i="none"){this.input.setSelectionRange(e,t,i)}setRangeText(e,t,i,s="preserve"){const r=t??this.input.selectionStart,n=i??this.input.selectionEnd;this.input.setRangeText(e,r,n,s),this.value!==this.input.value&&(this.value=this.input.value)}showPicker(){"showPicker"in HTMLInputElement.prototype&&this.input.showPicker()}stepUp(){this.input.stepUp(),this.value!==this.input.value&&(this.value=this.input.value)}stepDown(){this.input.stepDown(),this.value!==this.input.value&&(this.value=this.input.value)}checkValidity(){return this.input.checkValidity()}getForm(){return this.formControlController.getForm()}reportValidity(){return this.input.reportValidity()}setCustomValidity(e){this.input.setCustomValidity(e),this.formControlController.updateValidity()}render(){const e=this.hasSlotController.test("label"),t=this.hasSlotController.test("help-text"),i=this.label?!0:!!e,s=this.helpText?!0:!!t,n=this.clearable&&!this.disabled&&!this.readonly&&(typeof this.value=="number"||this.value.length>0);return T`
      <div
        part="form-control"
        class=${Ce({"form-control":!0,"form-control--small":this.size==="small","form-control--medium":this.size==="medium","form-control--large":this.size==="large","form-control--has-label":i,"form-control--has-help-text":s})}
      >
        <label
          part="form-control-label"
          class="form-control__label"
          for="input"
          aria-hidden=${i?"false":"true"}
        >
          <slot name="label">${this.label}</slot>
        </label>

        <div part="form-control-input" class="form-control-input">
          <div
            part="base"
            class=${Ce({input:!0,"input--small":this.size==="small","input--medium":this.size==="medium","input--large":this.size==="large","input--pill":this.pill,"input--standard":!this.filled,"input--filled":this.filled,"input--disabled":this.disabled,"input--focused":this.hasFocus,"input--empty":!this.value,"input--no-spin-buttons":this.noSpinButtons})}
          >
            <span part="prefix" class="input__prefix">
              <slot name="prefix"></slot>
            </span>

            <input
              part="input"
              id="input"
              class="input__control"
              type=${this.type==="password"&&this.passwordVisible?"text":this.type}
              title=${this.title}
              name=${pe(this.name)}
              ?disabled=${this.disabled}
              ?readonly=${this.readonly}
              ?required=${this.required}
              placeholder=${pe(this.placeholder)}
              minlength=${pe(this.minlength)}
              maxlength=${pe(this.maxlength)}
              min=${pe(this.min)}
              max=${pe(this.max)}
              step=${pe(this.step)}
              .value=${gp(this.value)}
              autocapitalize=${pe(this.autocapitalize)}
              autocomplete=${pe(this.autocomplete)}
              autocorrect=${pe(this.autocorrect)}
              ?autofocus=${this.autofocus}
              spellcheck=${this.spellcheck}
              pattern=${pe(this.pattern)}
              enterkeyhint=${pe(this.enterkeyhint)}
              inputmode=${pe(this.inputmode)}
              aria-describedby="help-text"
              @change=${this.handleChange}
              @input=${this.handleInput}
              @invalid=${this.handleInvalid}
              @keydown=${this.handleKeyDown}
              @focus=${this.handleFocus}
              @blur=${this.handleBlur}
            />

            ${n?T`
                  <button
                    part="clear-button"
                    class="input__clear"
                    type="button"
                    aria-label=${this.localize.term("clearEntry")}
                    @click=${this.handleClearClick}
                    tabindex="-1"
                  >
                    <slot name="clear-icon">
                      <sl-icon name="x-circle-fill" library="system"></sl-icon>
                    </slot>
                  </button>
                `:""}
            ${this.passwordToggle&&!this.disabled?T`
                  <button
                    part="password-toggle-button"
                    class="input__password-toggle"
                    type="button"
                    aria-label=${this.localize.term(this.passwordVisible?"hidePassword":"showPassword")}
                    @click=${this.handlePasswordToggle}
                    tabindex="-1"
                  >
                    ${this.passwordVisible?T`
                          <slot name="show-password-icon">
                            <sl-icon name="eye-slash" library="system"></sl-icon>
                          </slot>
                        `:T`
                          <slot name="hide-password-icon">
                            <sl-icon name="eye" library="system"></sl-icon>
                          </slot>
                        `}
                  </button>
                `:""}

            <span part="suffix" class="input__suffix">
              <slot name="suffix"></slot>
            </span>
          </div>
        </div>

        <div
          part="form-control-help-text"
          id="help-text"
          class="form-control__help-text"
          aria-hidden=${s?"false":"true"}
        >
          <slot name="help-text">${this.helpText}</slot>
        </div>
      </div>
    `}};be.styles=[ze,Wn,Vg];be.dependencies={"sl-icon":pt};E([le(".input__control")],be.prototype,"input",2);E([U()],be.prototype,"hasFocus",2);E([k()],be.prototype,"title",2);E([k({reflect:!0})],be.prototype,"type",2);E([k()],be.prototype,"name",2);E([k()],be.prototype,"value",2);E([mp()],be.prototype,"defaultValue",2);E([k({reflect:!0})],be.prototype,"size",2);E([k({type:Boolean,reflect:!0})],be.prototype,"filled",2);E([k({type:Boolean,reflect:!0})],be.prototype,"pill",2);E([k()],be.prototype,"label",2);E([k({attribute:"help-text"})],be.prototype,"helpText",2);E([k({type:Boolean})],be.prototype,"clearable",2);E([k({type:Boolean,reflect:!0})],be.prototype,"disabled",2);E([k()],be.prototype,"placeholder",2);E([k({type:Boolean,reflect:!0})],be.prototype,"readonly",2);E([k({attribute:"password-toggle",type:Boolean})],be.prototype,"passwordToggle",2);E([k({attribute:"password-visible",type:Boolean})],be.prototype,"passwordVisible",2);E([k({attribute:"no-spin-buttons",type:Boolean})],be.prototype,"noSpinButtons",2);E([k({reflect:!0})],be.prototype,"form",2);E([k({type:Boolean,reflect:!0})],be.prototype,"required",2);E([k()],be.prototype,"pattern",2);E([k({type:Number})],be.prototype,"minlength",2);E([k({type:Number})],be.prototype,"maxlength",2);E([k()],be.prototype,"min",2);E([k()],be.prototype,"max",2);E([k()],be.prototype,"step",2);E([k()],be.prototype,"autocapitalize",2);E([k()],be.prototype,"autocorrect",2);E([k()],be.prototype,"autocomplete",2);E([k({type:Boolean})],be.prototype,"autofocus",2);E([k()],be.prototype,"enterkeyhint",2);E([k({type:Boolean,converter:{fromAttribute:e=>!(!e||e==="false"),toAttribute:e=>e?"true":"false"}})],be.prototype,"spellcheck",2);E([k()],be.prototype,"inputmode",2);E([we("disabled",{waitUntilFirstUpdate:!0})],be.prototype,"handleDisabledChange",1);E([we("step",{waitUntilFirstUpdate:!0})],be.prototype,"handleStepChange",1);E([we("value",{waitUntilFirstUpdate:!0})],be.prototype,"handleValueChange",1);be.define("sl-input");var jg=ee`
  :host {
    display: block;
  }

  .textarea {
    display: grid;
    align-items: center;
    position: relative;
    width: 100%;
    font-family: var(--sl-input-font-family);
    font-weight: var(--sl-input-font-weight);
    line-height: var(--sl-line-height-normal);
    letter-spacing: var(--sl-input-letter-spacing);
    vertical-align: middle;
    transition:
      var(--sl-transition-fast) color,
      var(--sl-transition-fast) border,
      var(--sl-transition-fast) box-shadow,
      var(--sl-transition-fast) background-color;
    cursor: text;
  }

  /* Standard textareas */
  .textarea--standard {
    background-color: var(--sl-input-background-color);
    border: solid var(--sl-input-border-width) var(--sl-input-border-color);
  }

  .textarea--standard:hover:not(.textarea--disabled) {
    background-color: var(--sl-input-background-color-hover);
    border-color: var(--sl-input-border-color-hover);
  }
  .textarea--standard:hover:not(.textarea--disabled) .textarea__control {
    color: var(--sl-input-color-hover);
  }

  .textarea--standard.textarea--focused:not(.textarea--disabled) {
    background-color: var(--sl-input-background-color-focus);
    border-color: var(--sl-input-border-color-focus);
    color: var(--sl-input-color-focus);
    box-shadow: 0 0 0 var(--sl-focus-ring-width) var(--sl-input-focus-ring-color);
  }

  .textarea--standard.textarea--focused:not(.textarea--disabled) .textarea__control {
    color: var(--sl-input-color-focus);
  }

  .textarea--standard.textarea--disabled {
    background-color: var(--sl-input-background-color-disabled);
    border-color: var(--sl-input-border-color-disabled);
    opacity: 0.5;
    cursor: not-allowed;
  }

  .textarea__control,
  .textarea__size-adjuster {
    grid-area: 1 / 1 / 2 / 2;
  }

  .textarea__size-adjuster {
    visibility: hidden;
    pointer-events: none;
    opacity: 0;
  }

  .textarea--standard.textarea--disabled .textarea__control {
    color: var(--sl-input-color-disabled);
  }

  .textarea--standard.textarea--disabled .textarea__control::placeholder {
    color: var(--sl-input-placeholder-color-disabled);
  }

  /* Filled textareas */
  .textarea--filled {
    border: none;
    background-color: var(--sl-input-filled-background-color);
    color: var(--sl-input-color);
  }

  .textarea--filled:hover:not(.textarea--disabled) {
    background-color: var(--sl-input-filled-background-color-hover);
  }

  .textarea--filled.textarea--focused:not(.textarea--disabled) {
    background-color: var(--sl-input-filled-background-color-focus);
    outline: var(--sl-focus-ring);
    outline-offset: var(--sl-focus-ring-offset);
  }

  .textarea--filled.textarea--disabled {
    background-color: var(--sl-input-filled-background-color-disabled);
    opacity: 0.5;
    cursor: not-allowed;
  }

  .textarea__control {
    font-family: inherit;
    font-size: inherit;
    font-weight: inherit;
    line-height: 1.4;
    color: var(--sl-input-color);
    border: none;
    background: none;
    box-shadow: none;
    cursor: inherit;
    -webkit-appearance: none;
  }

  .textarea__control::-webkit-search-decoration,
  .textarea__control::-webkit-search-cancel-button,
  .textarea__control::-webkit-search-results-button,
  .textarea__control::-webkit-search-results-decoration {
    -webkit-appearance: none;
  }

  .textarea__control::placeholder {
    color: var(--sl-input-placeholder-color);
    user-select: none;
    -webkit-user-select: none;
  }

  .textarea__control:focus {
    outline: none;
  }

  /*
   * Size modifiers
   */

  .textarea--small {
    border-radius: var(--sl-input-border-radius-small);
    font-size: var(--sl-input-font-size-small);
  }

  .textarea--small .textarea__control {
    padding: 0.5em var(--sl-input-spacing-small);
  }

  .textarea--medium {
    border-radius: var(--sl-input-border-radius-medium);
    font-size: var(--sl-input-font-size-medium);
  }

  .textarea--medium .textarea__control {
    padding: 0.5em var(--sl-input-spacing-medium);
  }

  .textarea--large {
    border-radius: var(--sl-input-border-radius-large);
    font-size: var(--sl-input-font-size-large);
  }

  .textarea--large .textarea__control {
    padding: 0.5em var(--sl-input-spacing-large);
  }

  /*
   * Resize types
   */

  .textarea--resize-none .textarea__control {
    resize: none;
  }

  .textarea--resize-vertical .textarea__control {
    resize: vertical;
  }

  .textarea--resize-auto .textarea__control {
    height: auto;
    resize: none;
    overflow-y: hidden;
  }
`,Ie=class extends Ae{constructor(){super(...arguments),this.formControlController=new jr(this,{assumeInteractionOn:["sl-blur","sl-input"]}),this.hasSlotController=new Ci(this,"help-text","label"),this.hasFocus=!1,this.title="",this.name="",this.value="",this.size="medium",this.filled=!1,this.label="",this.helpText="",this.placeholder="",this.rows=4,this.resize="vertical",this.disabled=!1,this.readonly=!1,this.form="",this.required=!1,this.spellcheck=!0,this.defaultValue=""}get validity(){return this.input.validity}get validationMessage(){return this.input.validationMessage}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(()=>this.setTextareaHeight()),this.updateComplete.then(()=>{this.setTextareaHeight(),this.resizeObserver.observe(this.input)})}firstUpdated(){this.formControlController.updateValidity()}disconnectedCallback(){var e;super.disconnectedCallback(),this.input&&((e=this.resizeObserver)==null||e.unobserve(this.input))}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleChange(){this.value=this.input.value,this.setTextareaHeight(),this.emit("sl-change")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleInput(){this.value=this.input.value,this.emit("sl-input")}handleInvalid(e){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(e)}setTextareaHeight(){this.resize==="auto"?(this.sizeAdjuster.style.height=`${this.input.clientHeight}px`,this.input.style.height="auto",this.input.style.height=`${this.input.scrollHeight}px`):this.input.style.height=""}handleDisabledChange(){this.formControlController.setValidity(this.disabled)}handleRowsChange(){this.setTextareaHeight()}async handleValueChange(){await this.updateComplete,this.formControlController.updateValidity(),this.setTextareaHeight()}focus(e){this.input.focus(e)}blur(){this.input.blur()}select(){this.input.select()}scrollPosition(e){if(e){typeof e.top=="number"&&(this.input.scrollTop=e.top),typeof e.left=="number"&&(this.input.scrollLeft=e.left);return}return{top:this.input.scrollTop,left:this.input.scrollTop}}setSelectionRange(e,t,i="none"){this.input.setSelectionRange(e,t,i)}setRangeText(e,t,i,s="preserve"){const r=t??this.input.selectionStart,n=i??this.input.selectionEnd;this.input.setRangeText(e,r,n,s),this.value!==this.input.value&&(this.value=this.input.value,this.setTextareaHeight())}checkValidity(){return this.input.checkValidity()}getForm(){return this.formControlController.getForm()}reportValidity(){return this.input.reportValidity()}setCustomValidity(e){this.input.setCustomValidity(e),this.formControlController.updateValidity()}render(){const e=this.hasSlotController.test("label"),t=this.hasSlotController.test("help-text"),i=this.label?!0:!!e,s=this.helpText?!0:!!t;return T`
      <div
        part="form-control"
        class=${Ce({"form-control":!0,"form-control--small":this.size==="small","form-control--medium":this.size==="medium","form-control--large":this.size==="large","form-control--has-label":i,"form-control--has-help-text":s})}
      >
        <label
          part="form-control-label"
          class="form-control__label"
          for="input"
          aria-hidden=${i?"false":"true"}
        >
          <slot name="label">${this.label}</slot>
        </label>

        <div part="form-control-input" class="form-control-input">
          <div
            part="base"
            class=${Ce({textarea:!0,"textarea--small":this.size==="small","textarea--medium":this.size==="medium","textarea--large":this.size==="large","textarea--standard":!this.filled,"textarea--filled":this.filled,"textarea--disabled":this.disabled,"textarea--focused":this.hasFocus,"textarea--empty":!this.value,"textarea--resize-none":this.resize==="none","textarea--resize-vertical":this.resize==="vertical","textarea--resize-auto":this.resize==="auto"})}
          >
            <textarea
              part="textarea"
              id="input"
              class="textarea__control"
              title=${this.title}
              name=${pe(this.name)}
              .value=${gp(this.value)}
              ?disabled=${this.disabled}
              ?readonly=${this.readonly}
              ?required=${this.required}
              placeholder=${pe(this.placeholder)}
              rows=${pe(this.rows)}
              minlength=${pe(this.minlength)}
              maxlength=${pe(this.maxlength)}
              autocapitalize=${pe(this.autocapitalize)}
              autocorrect=${pe(this.autocorrect)}
              ?autofocus=${this.autofocus}
              spellcheck=${pe(this.spellcheck)}
              enterkeyhint=${pe(this.enterkeyhint)}
              inputmode=${pe(this.inputmode)}
              aria-describedby="help-text"
              @change=${this.handleChange}
              @input=${this.handleInput}
              @invalid=${this.handleInvalid}
              @focus=${this.handleFocus}
              @blur=${this.handleBlur}
            ></textarea>
            <!-- This "adjuster" exists to prevent layout shifting. https://github.com/shoelace-style/shoelace/issues/2180 -->
            <div part="textarea-adjuster" class="textarea__size-adjuster" ?hidden=${this.resize!=="auto"}></div>
          </div>
        </div>

        <div
          part="form-control-help-text"
          id="help-text"
          class="form-control__help-text"
          aria-hidden=${s?"false":"true"}
        >
          <slot name="help-text">${this.helpText}</slot>
        </div>
      </div>
    `}};Ie.styles=[ze,Wn,jg];E([le(".textarea__control")],Ie.prototype,"input",2);E([le(".textarea__size-adjuster")],Ie.prototype,"sizeAdjuster",2);E([U()],Ie.prototype,"hasFocus",2);E([k()],Ie.prototype,"title",2);E([k()],Ie.prototype,"name",2);E([k()],Ie.prototype,"value",2);E([k({reflect:!0})],Ie.prototype,"size",2);E([k({type:Boolean,reflect:!0})],Ie.prototype,"filled",2);E([k()],Ie.prototype,"label",2);E([k({attribute:"help-text"})],Ie.prototype,"helpText",2);E([k()],Ie.prototype,"placeholder",2);E([k({type:Number})],Ie.prototype,"rows",2);E([k()],Ie.prototype,"resize",2);E([k({type:Boolean,reflect:!0})],Ie.prototype,"disabled",2);E([k({type:Boolean,reflect:!0})],Ie.prototype,"readonly",2);E([k({reflect:!0})],Ie.prototype,"form",2);E([k({type:Boolean,reflect:!0})],Ie.prototype,"required",2);E([k({type:Number})],Ie.prototype,"minlength",2);E([k({type:Number})],Ie.prototype,"maxlength",2);E([k()],Ie.prototype,"autocapitalize",2);E([k()],Ie.prototype,"autocorrect",2);E([k()],Ie.prototype,"autocomplete",2);E([k({type:Boolean})],Ie.prototype,"autofocus",2);E([k()],Ie.prototype,"enterkeyhint",2);E([k({type:Boolean,converter:{fromAttribute:e=>!(!e||e==="false"),toAttribute:e=>e?"true":"false"}})],Ie.prototype,"spellcheck",2);E([k()],Ie.prototype,"inputmode",2);E([mp()],Ie.prototype,"defaultValue",2);E([we("disabled",{waitUntilFirstUpdate:!0})],Ie.prototype,"handleDisabledChange",1);E([we("rows",{waitUntilFirstUpdate:!0})],Ie.prototype,"handleRowsChange",1);E([we("value",{waitUntilFirstUpdate:!0})],Ie.prototype,"handleValueChange",1);Ie.define("sl-textarea");var Gg=ee`
  :host {
    --max-width: 20rem;
    --hide-delay: 0ms;
    --show-delay: 150ms;

    display: contents;
  }

  .tooltip {
    --arrow-size: var(--sl-tooltip-arrow-size);
    --arrow-color: var(--sl-tooltip-background-color);
  }

  .tooltip::part(popup) {
    z-index: var(--sl-z-index-tooltip);
  }

  .tooltip[placement^='top']::part(popup) {
    transform-origin: bottom;
  }

  .tooltip[placement^='bottom']::part(popup) {
    transform-origin: top;
  }

  .tooltip[placement^='left']::part(popup) {
    transform-origin: right;
  }

  .tooltip[placement^='right']::part(popup) {
    transform-origin: left;
  }

  .tooltip__body {
    display: block;
    width: max-content;
    max-width: var(--max-width);
    border-radius: var(--sl-tooltip-border-radius);
    background-color: var(--sl-tooltip-background-color);
    font-family: var(--sl-tooltip-font-family);
    font-size: var(--sl-tooltip-font-size);
    font-weight: var(--sl-tooltip-font-weight);
    line-height: var(--sl-tooltip-line-height);
    text-align: start;
    white-space: normal;
    color: var(--sl-tooltip-color);
    padding: var(--sl-tooltip-padding);
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
  }
`,ft=class extends Ae{constructor(){super(),this.localize=new Ot(this),this.content="",this.placement="top",this.disabled=!1,this.distance=8,this.open=!1,this.skidding=0,this.trigger="hover focus",this.hoist=!1,this.handleBlur=()=>{this.hasTrigger("focus")&&this.hide()},this.handleClick=()=>{this.hasTrigger("click")&&(this.open?this.hide():this.show())},this.handleFocus=()=>{this.hasTrigger("focus")&&this.show()},this.handleDocumentKeyDown=e=>{e.key==="Escape"&&(e.stopPropagation(),this.hide())},this.handleMouseOver=()=>{if(this.hasTrigger("hover")){const e=ud(getComputedStyle(this).getPropertyValue("--show-delay"));clearTimeout(this.hoverTimeout),this.hoverTimeout=window.setTimeout(()=>this.show(),e)}},this.handleMouseOut=()=>{if(this.hasTrigger("hover")){const e=ud(getComputedStyle(this).getPropertyValue("--hide-delay"));clearTimeout(this.hoverTimeout),this.hoverTimeout=window.setTimeout(()=>this.hide(),e)}},this.addEventListener("blur",this.handleBlur,!0),this.addEventListener("focus",this.handleFocus,!0),this.addEventListener("click",this.handleClick),this.addEventListener("mouseover",this.handleMouseOver),this.addEventListener("mouseout",this.handleMouseOut)}disconnectedCallback(){var e;super.disconnectedCallback(),(e=this.closeWatcher)==null||e.destroy(),document.removeEventListener("keydown",this.handleDocumentKeyDown)}firstUpdated(){this.body.hidden=!this.open,this.open&&(this.popup.active=!0,this.popup.reposition())}hasTrigger(e){return this.trigger.split(" ").includes(e)}async handleOpenChange(){var e,t;if(this.open){if(this.disabled)return;this.emit("sl-show"),"CloseWatcher"in window?((e=this.closeWatcher)==null||e.destroy(),this.closeWatcher=new CloseWatcher,this.closeWatcher.onclose=()=>{this.hide()}):document.addEventListener("keydown",this.handleDocumentKeyDown),await Dt(this.body),this.body.hidden=!1,this.popup.active=!0;const{keyframes:i,options:s}=Tt(this,"tooltip.show",{dir:this.localize.dir()});await Ct(this.popup.popup,i,s),this.popup.reposition(),this.emit("sl-after-show")}else{this.emit("sl-hide"),(t=this.closeWatcher)==null||t.destroy(),document.removeEventListener("keydown",this.handleDocumentKeyDown),await Dt(this.body);const{keyframes:i,options:s}=Tt(this,"tooltip.hide",{dir:this.localize.dir()});await Ct(this.popup.popup,i,s),this.popup.active=!1,this.body.hidden=!0,this.emit("sl-after-hide")}}async handleOptionsChange(){this.hasUpdated&&(await this.updateComplete,this.popup.reposition())}handleDisabledChange(){this.disabled&&this.open&&this.hide()}async show(){if(!this.open)return this.open=!0,Yt(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,Yt(this,"sl-after-hide")}render(){return T`
      <sl-popup
        part="base"
        exportparts="
          popup:base__popup,
          arrow:base__arrow
        "
        class=${Ce({tooltip:!0,"tooltip--open":this.open})}
        placement=${this.placement}
        distance=${this.distance}
        skidding=${this.skidding}
        strategy=${this.hoist?"fixed":"absolute"}
        flip
        shift
        arrow
        hover-bridge
      >
        ${""}
        <slot slot="anchor" aria-describedby="tooltip"></slot>

        ${""}
        <div part="body" id="tooltip" class="tooltip__body" role="tooltip" aria-live=${this.open?"polite":"off"}>
          <slot name="content">${this.content}</slot>
        </div>
      </sl-popup>
    `}};ft.styles=[ze,Gg];ft.dependencies={"sl-popup":Le};E([le("slot:not([name])")],ft.prototype,"defaultSlot",2);E([le(".tooltip__body")],ft.prototype,"body",2);E([le("sl-popup")],ft.prototype,"popup",2);E([k()],ft.prototype,"content",2);E([k()],ft.prototype,"placement",2);E([k({type:Boolean,reflect:!0})],ft.prototype,"disabled",2);E([k({type:Number})],ft.prototype,"distance",2);E([k({type:Boolean,reflect:!0})],ft.prototype,"open",2);E([k({type:Number})],ft.prototype,"skidding",2);E([k()],ft.prototype,"trigger",2);E([k({type:Boolean})],ft.prototype,"hoist",2);E([we("open",{waitUntilFirstUpdate:!0})],ft.prototype,"handleOpenChange",1);E([we(["content","distance","hoist","placement","skidding"])],ft.prototype,"handleOptionsChange",1);E([we("disabled")],ft.prototype,"handleDisabledChange",1);At("tooltip.show",{keyframes:[{opacity:0,scale:.8},{opacity:1,scale:1}],options:{duration:150,easing:"ease"}});At("tooltip.hide",{keyframes:[{opacity:1,scale:1},{opacity:0,scale:.8}],options:{duration:150,easing:"ease"}});ft.define("sl-tooltip");var Wg=ee`
  :host {
    --indicator-color: var(--sl-color-primary-600);
    --track-color: var(--sl-color-neutral-200);
    --track-width: 2px;

    display: block;
  }

  .tab-group {
    display: flex;
    border-radius: 0;
  }

  .tab-group__tabs {
    display: flex;
    position: relative;
  }

  .tab-group__indicator {
    position: absolute;
    transition:
      var(--sl-transition-fast) translate ease,
      var(--sl-transition-fast) width ease;
  }

  .tab-group--has-scroll-controls .tab-group__nav-container {
    position: relative;
    padding: 0 var(--sl-spacing-x-large);
  }

  .tab-group--has-scroll-controls .tab-group__scroll-button--start--hidden,
  .tab-group--has-scroll-controls .tab-group__scroll-button--end--hidden {
    visibility: hidden;
  }

  .tab-group__body {
    display: block;
    overflow: auto;
  }

  .tab-group__scroll-button {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 0;
    bottom: 0;
    width: var(--sl-spacing-x-large);
  }

  .tab-group__scroll-button--start {
    left: 0;
  }

  .tab-group__scroll-button--end {
    right: 0;
  }

  .tab-group--rtl .tab-group__scroll-button--start {
    left: auto;
    right: 0;
  }

  .tab-group--rtl .tab-group__scroll-button--end {
    left: 0;
    right: auto;
  }

  /*
   * Top
   */

  .tab-group--top {
    flex-direction: column;
  }

  .tab-group--top .tab-group__nav-container {
    order: 1;
  }

  .tab-group--top .tab-group__nav {
    display: flex;
    overflow-x: auto;

    /* Hide scrollbar in Firefox */
    scrollbar-width: none;
  }

  /* Hide scrollbar in Chrome/Safari */
  .tab-group--top .tab-group__nav::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  .tab-group--top .tab-group__tabs {
    flex: 1 1 auto;
    position: relative;
    flex-direction: row;
    border-bottom: solid var(--track-width) var(--track-color);
  }

  .tab-group--top .tab-group__indicator {
    bottom: calc(-1 * var(--track-width));
    border-bottom: solid var(--track-width) var(--indicator-color);
  }

  .tab-group--top .tab-group__body {
    order: 2;
  }

  .tab-group--top ::slotted(sl-tab-panel) {
    --padding: var(--sl-spacing-medium) 0;
  }

  /*
   * Bottom
   */

  .tab-group--bottom {
    flex-direction: column;
  }

  .tab-group--bottom .tab-group__nav-container {
    order: 2;
  }

  .tab-group--bottom .tab-group__nav {
    display: flex;
    overflow-x: auto;

    /* Hide scrollbar in Firefox */
    scrollbar-width: none;
  }

  /* Hide scrollbar in Chrome/Safari */
  .tab-group--bottom .tab-group__nav::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  .tab-group--bottom .tab-group__tabs {
    flex: 1 1 auto;
    position: relative;
    flex-direction: row;
    border-top: solid var(--track-width) var(--track-color);
  }

  .tab-group--bottom .tab-group__indicator {
    top: calc(-1 * var(--track-width));
    border-top: solid var(--track-width) var(--indicator-color);
  }

  .tab-group--bottom .tab-group__body {
    order: 1;
  }

  .tab-group--bottom ::slotted(sl-tab-panel) {
    --padding: var(--sl-spacing-medium) 0;
  }

  /*
   * Start
   */

  .tab-group--start {
    flex-direction: row;
  }

  .tab-group--start .tab-group__nav-container {
    order: 1;
  }

  .tab-group--start .tab-group__tabs {
    flex: 0 0 auto;
    flex-direction: column;
    border-inline-end: solid var(--track-width) var(--track-color);
  }

  .tab-group--start .tab-group__indicator {
    right: calc(-1 * var(--track-width));
    border-right: solid var(--track-width) var(--indicator-color);
  }

  .tab-group--start.tab-group--rtl .tab-group__indicator {
    right: auto;
    left: calc(-1 * var(--track-width));
  }

  .tab-group--start .tab-group__body {
    flex: 1 1 auto;
    order: 2;
  }

  .tab-group--start ::slotted(sl-tab-panel) {
    --padding: 0 var(--sl-spacing-medium);
  }

  /*
   * End
   */

  .tab-group--end {
    flex-direction: row;
  }

  .tab-group--end .tab-group__nav-container {
    order: 2;
  }

  .tab-group--end .tab-group__tabs {
    flex: 0 0 auto;
    flex-direction: column;
    border-left: solid var(--track-width) var(--track-color);
  }

  .tab-group--end .tab-group__indicator {
    left: calc(-1 * var(--track-width));
    border-inline-start: solid var(--track-width) var(--indicator-color);
  }

  .tab-group--end.tab-group--rtl .tab-group__indicator {
    right: calc(-1 * var(--track-width));
    left: auto;
  }

  .tab-group--end .tab-group__body {
    flex: 1 1 auto;
    order: 1;
  }

  .tab-group--end ::slotted(sl-tab-panel) {
    --padding: 0 var(--sl-spacing-medium);
  }
`,Yg=ee`
  :host {
    display: contents;
  }
`,so=class extends Ae{constructor(){super(...arguments),this.observedElements=[],this.disabled=!1}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(e=>{this.emit("sl-resize",{detail:{entries:e}})}),this.disabled||this.startObserver()}disconnectedCallback(){super.disconnectedCallback(),this.stopObserver()}handleSlotChange(){this.disabled||this.startObserver()}startObserver(){const e=this.shadowRoot.querySelector("slot");if(e!==null){const t=e.assignedElements({flatten:!0});this.observedElements.forEach(i=>this.resizeObserver.unobserve(i)),this.observedElements=[],t.forEach(i=>{this.resizeObserver.observe(i),this.observedElements.push(i)})}}stopObserver(){this.resizeObserver.disconnect()}handleDisabledChange(){this.disabled?this.stopObserver():this.startObserver()}render(){return T` <slot @slotchange=${this.handleSlotChange}></slot> `}};so.styles=[ze,Yg];E([k({type:Boolean,reflect:!0})],so.prototype,"disabled",2);E([we("disabled",{waitUntilFirstUpdate:!0})],so.prototype,"handleDisabledChange",1);var mt=class extends Ae{constructor(){super(...arguments),this.tabs=[],this.focusableTabs=[],this.panels=[],this.localize=new Ot(this),this.hasScrollControls=!1,this.shouldHideScrollStartButton=!1,this.shouldHideScrollEndButton=!1,this.placement="top",this.activation="auto",this.noScrollControls=!1,this.fixedScrollControls=!1,this.scrollOffset=1}connectedCallback(){const e=Promise.all([customElements.whenDefined("sl-tab"),customElements.whenDefined("sl-tab-panel")]);super.connectedCallback(),this.resizeObserver=new ResizeObserver(()=>{this.repositionIndicator(),this.updateScrollControls()}),this.mutationObserver=new MutationObserver(t=>{const i=t.filter(({target:s})=>{if(s===this)return!0;if(s.closest("sl-tab-group")!==this)return!1;const r=s.tagName.toLowerCase();return r==="sl-tab"||r==="sl-tab-panel"});if(i.length!==0){if(i.some(s=>!["aria-labelledby","aria-controls"].includes(s.attributeName))&&setTimeout(()=>this.setAriaLabels()),i.some(s=>s.attributeName==="disabled"))this.syncTabsAndPanels();else if(i.some(s=>s.attributeName==="active")){const r=i.filter(n=>n.attributeName==="active"&&n.target.tagName.toLowerCase()==="sl-tab").map(n=>n.target).find(n=>n.active);r&&this.setActiveTab(r)}}}),this.updateComplete.then(()=>{this.syncTabsAndPanels(),this.mutationObserver.observe(this,{attributes:!0,attributeFilter:["active","disabled","name","panel"],childList:!0,subtree:!0}),this.resizeObserver.observe(this.nav),e.then(()=>{new IntersectionObserver((i,s)=>{var r;i[0].intersectionRatio>0&&(this.setAriaLabels(),this.setActiveTab((r=this.getActiveTab())!=null?r:this.tabs[0],{emitEvents:!1}),s.unobserve(i[0].target))}).observe(this.tabGroup)})})}disconnectedCallback(){var e,t;super.disconnectedCallback(),(e=this.mutationObserver)==null||e.disconnect(),this.nav&&((t=this.resizeObserver)==null||t.unobserve(this.nav))}getAllTabs(){return this.shadowRoot.querySelector('slot[name="nav"]').assignedElements()}getAllPanels(){return[...this.body.assignedElements()].filter(e=>e.tagName.toLowerCase()==="sl-tab-panel")}getActiveTab(){return this.tabs.find(e=>e.active)}handleClick(e){const i=e.target.closest("sl-tab");(i==null?void 0:i.closest("sl-tab-group"))===this&&i!==null&&this.setActiveTab(i,{scrollBehavior:"smooth"})}handleKeyDown(e){const i=e.target.closest("sl-tab");if((i==null?void 0:i.closest("sl-tab-group"))===this&&(["Enter"," "].includes(e.key)&&i!==null&&(this.setActiveTab(i,{scrollBehavior:"smooth"}),e.preventDefault()),["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(e.key))){const r=this.tabs.find(a=>a.matches(":focus")),n=this.localize.dir()==="rtl";let o=null;if((r==null?void 0:r.tagName.toLowerCase())==="sl-tab"){if(e.key==="Home")o=this.focusableTabs[0];else if(e.key==="End")o=this.focusableTabs[this.focusableTabs.length-1];else if(["top","bottom"].includes(this.placement)&&e.key===(n?"ArrowRight":"ArrowLeft")||["start","end"].includes(this.placement)&&e.key==="ArrowUp"){const a=this.tabs.findIndex(c=>c===r);o=this.findNextFocusableTab(a,"backward")}else if(["top","bottom"].includes(this.placement)&&e.key===(n?"ArrowLeft":"ArrowRight")||["start","end"].includes(this.placement)&&e.key==="ArrowDown"){const a=this.tabs.findIndex(c=>c===r);o=this.findNextFocusableTab(a,"forward")}if(!o)return;o.tabIndex=0,o.focus({preventScroll:!0}),this.activation==="auto"?this.setActiveTab(o,{scrollBehavior:"smooth"}):this.tabs.forEach(a=>{a.tabIndex=a===o?0:-1}),["top","bottom"].includes(this.placement)&&Il(o,this.nav,"horizontal"),e.preventDefault()}}}handleScrollToStart(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft+this.nav.clientWidth:this.nav.scrollLeft-this.nav.clientWidth,behavior:"smooth"})}handleScrollToEnd(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft-this.nav.clientWidth:this.nav.scrollLeft+this.nav.clientWidth,behavior:"smooth"})}setActiveTab(e,t){if(t=qi({emitEvents:!0,scrollBehavior:"auto"},t),e!==this.activeTab&&!e.disabled){const i=this.activeTab;this.activeTab=e,this.tabs.forEach(s=>{s.active=s===this.activeTab,s.tabIndex=s===this.activeTab?0:-1}),this.panels.forEach(s=>{var r;return s.active=s.name===((r=this.activeTab)==null?void 0:r.panel)}),this.syncIndicator(),["top","bottom"].includes(this.placement)&&Il(this.activeTab,this.nav,"horizontal",t.scrollBehavior),t.emitEvents&&(i&&this.emit("sl-tab-hide",{detail:{name:i.panel}}),this.emit("sl-tab-show",{detail:{name:this.activeTab.panel}}))}}setAriaLabels(){this.tabs.forEach(e=>{const t=this.panels.find(i=>i.name===e.panel);t&&(e.setAttribute("aria-controls",t.getAttribute("id")),t.setAttribute("aria-labelledby",e.getAttribute("id")))})}repositionIndicator(){const e=this.getActiveTab();if(!e)return;const t=e.clientWidth,i=e.clientHeight,s=this.localize.dir()==="rtl",r=this.getAllTabs(),o=r.slice(0,r.indexOf(e)).reduce((a,c)=>({left:a.left+c.clientWidth,top:a.top+c.clientHeight}),{left:0,top:0});switch(this.placement){case"top":case"bottom":this.indicator.style.width=`${t}px`,this.indicator.style.height="auto",this.indicator.style.translate=s?`${-1*o.left}px`:`${o.left}px`;break;case"start":case"end":this.indicator.style.width="auto",this.indicator.style.height=`${i}px`,this.indicator.style.translate=`0 ${o.top}px`;break}}syncTabsAndPanels(){this.tabs=this.getAllTabs(),this.focusableTabs=this.tabs.filter(e=>!e.disabled),this.panels=this.getAllPanels(),this.syncIndicator(),this.updateComplete.then(()=>this.updateScrollControls())}findNextFocusableTab(e,t){let i=null;const s=t==="forward"?1:-1;let r=e+s;for(;e<this.tabs.length;){if(i=this.tabs[r]||null,i===null){t==="forward"?i=this.focusableTabs[0]:i=this.focusableTabs[this.focusableTabs.length-1];break}if(!i.disabled)break;r+=s}return i}updateScrollButtons(){this.hasScrollControls&&!this.fixedScrollControls&&(this.shouldHideScrollStartButton=this.scrollFromStart()<=this.scrollOffset,this.shouldHideScrollEndButton=this.isScrolledToEnd())}isScrolledToEnd(){return this.scrollFromStart()+this.nav.clientWidth>=this.nav.scrollWidth-this.scrollOffset}scrollFromStart(){return this.localize.dir()==="rtl"?-this.nav.scrollLeft:this.nav.scrollLeft}updateScrollControls(){this.noScrollControls?this.hasScrollControls=!1:this.hasScrollControls=["top","bottom"].includes(this.placement)&&this.nav.scrollWidth>this.nav.clientWidth+1,this.updateScrollButtons()}syncIndicator(){this.getActiveTab()?(this.indicator.style.display="block",this.repositionIndicator()):this.indicator.style.display="none"}show(e){const t=this.tabs.find(i=>i.panel===e);t&&this.setActiveTab(t,{scrollBehavior:"smooth"})}render(){const e=this.localize.dir()==="rtl";return T`
      <div
        part="base"
        class=${Ce({"tab-group":!0,"tab-group--top":this.placement==="top","tab-group--bottom":this.placement==="bottom","tab-group--start":this.placement==="start","tab-group--end":this.placement==="end","tab-group--rtl":this.localize.dir()==="rtl","tab-group--has-scroll-controls":this.hasScrollControls})}
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
      >
        <div class="tab-group__nav-container" part="nav">
          ${this.hasScrollControls?T`
                <sl-icon-button
                  part="scroll-button scroll-button--start"
                  exportparts="base:scroll-button__base"
                  class=${Ce({"tab-group__scroll-button":!0,"tab-group__scroll-button--start":!0,"tab-group__scroll-button--start--hidden":this.shouldHideScrollStartButton})}
                  name=${e?"chevron-right":"chevron-left"}
                  library="system"
                  tabindex="-1"
                  aria-hidden="true"
                  label=${this.localize.term("scrollToStart")}
                  @click=${this.handleScrollToStart}
                ></sl-icon-button>
              `:""}

          <div class="tab-group__nav" @scrollend=${this.updateScrollButtons}>
            <div part="tabs" class="tab-group__tabs" role="tablist">
              <div part="active-tab-indicator" class="tab-group__indicator"></div>
              <sl-resize-observer @sl-resize=${this.syncIndicator}>
                <slot name="nav" @slotchange=${this.syncTabsAndPanels}></slot>
              </sl-resize-observer>
            </div>
          </div>

          ${this.hasScrollControls?T`
                <sl-icon-button
                  part="scroll-button scroll-button--end"
                  exportparts="base:scroll-button__base"
                  class=${Ce({"tab-group__scroll-button":!0,"tab-group__scroll-button--end":!0,"tab-group__scroll-button--end--hidden":this.shouldHideScrollEndButton})}
                  name=${e?"chevron-left":"chevron-right"}
                  library="system"
                  tabindex="-1"
                  aria-hidden="true"
                  label=${this.localize.term("scrollToEnd")}
                  @click=${this.handleScrollToEnd}
                ></sl-icon-button>
              `:""}
        </div>

        <slot part="body" class="tab-group__body" @slotchange=${this.syncTabsAndPanels}></slot>
      </div>
    `}};mt.styles=[ze,Wg];mt.dependencies={"sl-icon-button":at,"sl-resize-observer":so};E([le(".tab-group")],mt.prototype,"tabGroup",2);E([le(".tab-group__body")],mt.prototype,"body",2);E([le(".tab-group__nav")],mt.prototype,"nav",2);E([le(".tab-group__indicator")],mt.prototype,"indicator",2);E([U()],mt.prototype,"hasScrollControls",2);E([U()],mt.prototype,"shouldHideScrollStartButton",2);E([U()],mt.prototype,"shouldHideScrollEndButton",2);E([k()],mt.prototype,"placement",2);E([k()],mt.prototype,"activation",2);E([k({attribute:"no-scroll-controls",type:Boolean})],mt.prototype,"noScrollControls",2);E([k({attribute:"fixed-scroll-controls",type:Boolean})],mt.prototype,"fixedScrollControls",2);E([am({passive:!0})],mt.prototype,"updateScrollButtons",1);E([we("noScrollControls",{waitUntilFirstUpdate:!0})],mt.prototype,"updateScrollControls",1);E([we("placement",{waitUntilFirstUpdate:!0})],mt.prototype,"syncIndicator",1);mt.define("sl-tab-group");var Kg=(e,t)=>{let i=0;return function(...s){window.clearTimeout(i),i=window.setTimeout(()=>{e.call(this,...s)},t)}},fd=(e,t,i)=>{const s=e[t];e[t]=function(...r){s.call(this,...r),i.call(this,s,...r)}};(()=>{if(typeof window>"u")return;if(!("onscrollend"in window)){const t=new Set,i=new WeakMap,s=n=>{for(const o of n.changedTouches)t.add(o.identifier)},r=n=>{for(const o of n.changedTouches)t.delete(o.identifier)};document.addEventListener("touchstart",s,!0),document.addEventListener("touchend",r,!0),document.addEventListener("touchcancel",r,!0),fd(EventTarget.prototype,"addEventListener",function(n,o){if(o!=="scrollend")return;const a=Kg(()=>{t.size?a():this.dispatchEvent(new Event("scrollend"))},100);n.call(this,"scroll",a,{passive:!0}),i.set(this,a)}),fd(EventTarget.prototype,"removeEventListener",function(n,o){if(o!=="scrollend")return;const a=i.get(this);a&&n.call(this,"scroll",a,{passive:!0})})}})();var Xg=ee`
  :host {
    display: inline-block;
  }

  .tab {
    display: inline-flex;
    align-items: center;
    font-family: var(--sl-font-sans);
    font-size: var(--sl-font-size-small);
    font-weight: var(--sl-font-weight-semibold);
    border-radius: var(--sl-border-radius-medium);
    color: var(--sl-color-neutral-600);
    padding: var(--sl-spacing-medium) var(--sl-spacing-large);
    white-space: nowrap;
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;
    transition:
      var(--transition-speed) box-shadow,
      var(--transition-speed) color;
  }

  .tab:hover:not(.tab--disabled) {
    color: var(--sl-color-primary-600);
  }

  :host(:focus) {
    outline: transparent;
  }

  :host(:focus-visible) {
    color: var(--sl-color-primary-600);
    outline: var(--sl-focus-ring);
    outline-offset: calc(-1 * var(--sl-focus-ring-width) - var(--sl-focus-ring-offset));
  }

  .tab.tab--active:not(.tab--disabled) {
    color: var(--sl-color-primary-600);
  }

  .tab.tab--closable {
    padding-inline-end: var(--sl-spacing-small);
  }

  .tab.tab--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tab__close-button {
    font-size: var(--sl-font-size-small);
    margin-inline-start: var(--sl-spacing-small);
  }

  .tab__close-button::part(base) {
    padding: var(--sl-spacing-3x-small);
  }

  @media (forced-colors: active) {
    .tab.tab--active:not(.tab--disabled) {
      outline: solid 1px transparent;
      outline-offset: -3px;
    }
  }
`,Jg=0,ai=class extends Ae{constructor(){super(...arguments),this.localize=new Ot(this),this.attrId=++Jg,this.componentId=`sl-tab-${this.attrId}`,this.panel="",this.active=!1,this.closable=!1,this.disabled=!1,this.tabIndex=0}connectedCallback(){super.connectedCallback(),this.setAttribute("role","tab")}handleCloseClick(e){e.stopPropagation(),this.emit("sl-close")}handleActiveChange(){this.setAttribute("aria-selected",this.active?"true":"false")}handleDisabledChange(){this.setAttribute("aria-disabled",this.disabled?"true":"false"),this.disabled&&!this.active?this.tabIndex=-1:this.tabIndex=0}render(){return this.id=this.id.length>0?this.id:this.componentId,T`
      <div
        part="base"
        class=${Ce({tab:!0,"tab--active":this.active,"tab--closable":this.closable,"tab--disabled":this.disabled})}
      >
        <slot></slot>
        ${this.closable?T`
              <sl-icon-button
                part="close-button"
                exportparts="base:close-button__base"
                name="x-lg"
                library="system"
                label=${this.localize.term("close")}
                class="tab__close-button"
                @click=${this.handleCloseClick}
                tabindex="-1"
              ></sl-icon-button>
            `:""}
      </div>
    `}};ai.styles=[ze,Xg];ai.dependencies={"sl-icon-button":at};E([le(".tab")],ai.prototype,"tab",2);E([k({reflect:!0})],ai.prototype,"panel",2);E([k({type:Boolean,reflect:!0})],ai.prototype,"active",2);E([k({type:Boolean,reflect:!0})],ai.prototype,"closable",2);E([k({type:Boolean,reflect:!0})],ai.prototype,"disabled",2);E([k({type:Number,reflect:!0})],ai.prototype,"tabIndex",2);E([we("active")],ai.prototype,"handleActiveChange",1);E([we("disabled")],ai.prototype,"handleDisabledChange",1);ai.define("sl-tab");var Zg=ee`
  :host {
    --padding: 0;

    display: none;
  }

  :host([active]) {
    display: block;
  }

  .tab-panel {
    display: block;
    padding: var(--padding);
  }
`,Qg=0,Yr=class extends Ae{constructor(){super(...arguments),this.attrId=++Qg,this.componentId=`sl-tab-panel-${this.attrId}`,this.name="",this.active=!1}connectedCallback(){super.connectedCallback(),this.id=this.id.length>0?this.id:this.componentId,this.setAttribute("role","tabpanel")}handleActiveChange(){this.setAttribute("aria-hidden",this.active?"false":"true")}render(){return T`
      <slot
        part="base"
        class=${Ce({"tab-panel":!0,"tab-panel--active":this.active})}
      ></slot>
    `}};Yr.styles=[ze,Zg];E([k({reflect:!0})],Yr.prototype,"name",2);E([k({type:Boolean,reflect:!0})],Yr.prototype,"active",2);E([we("active")],Yr.prototype,"handleActiveChange",1);Yr.define("sl-tab-panel");var eb=ee`
  :host {
    display: inline-block;
  }

  .dropdown::part(popup) {
    z-index: var(--sl-z-index-dropdown);
  }

  .dropdown[data-current-placement^='top']::part(popup) {
    transform-origin: bottom;
  }

  .dropdown[data-current-placement^='bottom']::part(popup) {
    transform-origin: top;
  }

  .dropdown[data-current-placement^='left']::part(popup) {
    transform-origin: right;
  }

  .dropdown[data-current-placement^='right']::part(popup) {
    transform-origin: left;
  }

  .dropdown__trigger {
    display: block;
  }

  .dropdown__panel {
    font-family: var(--sl-font-sans);
    font-size: var(--sl-font-size-medium);
    font-weight: var(--sl-font-weight-normal);
    box-shadow: var(--sl-shadow-large);
    border-radius: var(--sl-border-radius-medium);
    pointer-events: none;
  }

  .dropdown--open .dropdown__panel {
    display: block;
    pointer-events: all;
  }

  /* When users slot a menu, make sure it conforms to the popup's auto-size */
  ::slotted(sl-menu) {
    max-width: var(--auto-size-available-width) !important;
    max-height: var(--auto-size-available-height) !important;
  }
`,wt=class extends Ae{constructor(){super(...arguments),this.localize=new Ot(this),this.open=!1,this.placement="bottom-start",this.disabled=!1,this.stayOpenOnSelect=!1,this.distance=0,this.skidding=0,this.hoist=!1,this.sync=void 0,this.handleKeyDown=e=>{this.open&&e.key==="Escape"&&(e.stopPropagation(),this.hide(),this.focusOnTrigger())},this.handleDocumentKeyDown=e=>{var t;if(e.key==="Escape"&&this.open&&!this.closeWatcher){e.stopPropagation(),this.focusOnTrigger(),this.hide();return}if(e.key==="Tab"){if(this.open&&((t=document.activeElement)==null?void 0:t.tagName.toLowerCase())==="sl-menu-item"){e.preventDefault(),this.hide(),this.focusOnTrigger();return}const i=(s,r)=>{if(!s)return null;const n=s.closest(r);if(n)return n;const o=s.getRootNode();return o instanceof ShadowRoot?i(o.host,r):null};setTimeout(()=>{var s;const r=((s=this.containingElement)==null?void 0:s.getRootNode())instanceof ShadowRoot?pp():document.activeElement;(!this.containingElement||i(r,this.containingElement.tagName.toLowerCase())!==this.containingElement)&&this.hide()})}},this.handleDocumentMouseDown=e=>{const t=e.composedPath();this.containingElement&&!t.includes(this.containingElement)&&this.hide()},this.handlePanelSelect=e=>{const t=e.target;!this.stayOpenOnSelect&&t.tagName.toLowerCase()==="sl-menu"&&(this.hide(),this.focusOnTrigger())}}connectedCallback(){super.connectedCallback(),this.containingElement||(this.containingElement=this)}firstUpdated(){this.panel.hidden=!this.open,this.open&&(this.addOpenListeners(),this.popup.active=!0)}disconnectedCallback(){super.disconnectedCallback(),this.removeOpenListeners(),this.hide()}focusOnTrigger(){const e=this.trigger.assignedElements({flatten:!0})[0];typeof(e==null?void 0:e.focus)=="function"&&e.focus()}getMenu(){return this.panel.assignedElements({flatten:!0}).find(e=>e.tagName.toLowerCase()==="sl-menu")}handleTriggerClick(){this.open?this.hide():(this.show(),this.focusOnTrigger())}async handleTriggerKeyDown(e){if([" ","Enter"].includes(e.key)){e.preventDefault(),this.handleTriggerClick();return}const t=this.getMenu();if(t){const i=t.getAllItems(),s=i[0],r=i[i.length-1];["ArrowDown","ArrowUp","Home","End"].includes(e.key)&&(e.preventDefault(),this.open||(this.show(),await this.updateComplete),i.length>0&&this.updateComplete.then(()=>{(e.key==="ArrowDown"||e.key==="Home")&&(t.setCurrentItem(s),s.focus()),(e.key==="ArrowUp"||e.key==="End")&&(t.setCurrentItem(r),r.focus())}))}}handleTriggerKeyUp(e){e.key===" "&&e.preventDefault()}handleTriggerSlotChange(){this.updateAccessibleTrigger()}updateAccessibleTrigger(){const t=this.trigger.assignedElements({flatten:!0}).find(s=>Bg(s).start);let i;if(t){switch(t.tagName.toLowerCase()){case"sl-button":case"sl-icon-button":i=t.button;break;default:i=t}i.setAttribute("aria-haspopup","true"),i.setAttribute("aria-expanded",this.open?"true":"false")}}async show(){if(!this.open)return this.open=!0,Yt(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,Yt(this,"sl-after-hide")}reposition(){this.popup.reposition()}addOpenListeners(){var e;this.panel.addEventListener("sl-select",this.handlePanelSelect),"CloseWatcher"in window?((e=this.closeWatcher)==null||e.destroy(),this.closeWatcher=new CloseWatcher,this.closeWatcher.onclose=()=>{this.hide(),this.focusOnTrigger()}):this.panel.addEventListener("keydown",this.handleKeyDown),document.addEventListener("keydown",this.handleDocumentKeyDown),document.addEventListener("mousedown",this.handleDocumentMouseDown)}removeOpenListeners(){var e;this.panel&&(this.panel.removeEventListener("sl-select",this.handlePanelSelect),this.panel.removeEventListener("keydown",this.handleKeyDown)),document.removeEventListener("keydown",this.handleDocumentKeyDown),document.removeEventListener("mousedown",this.handleDocumentMouseDown),(e=this.closeWatcher)==null||e.destroy()}async handleOpenChange(){if(this.disabled){this.open=!1;return}if(this.updateAccessibleTrigger(),this.open){this.emit("sl-show"),this.addOpenListeners(),await Dt(this),this.panel.hidden=!1,this.popup.active=!0;const{keyframes:e,options:t}=Tt(this,"dropdown.show",{dir:this.localize.dir()});await Ct(this.popup.popup,e,t),this.emit("sl-after-show")}else{this.emit("sl-hide"),this.removeOpenListeners(),await Dt(this);const{keyframes:e,options:t}=Tt(this,"dropdown.hide",{dir:this.localize.dir()});await Ct(this.popup.popup,e,t),this.panel.hidden=!0,this.popup.active=!1,this.emit("sl-after-hide")}}render(){return T`
      <sl-popup
        part="base"
        exportparts="popup:base__popup"
        id="dropdown"
        placement=${this.placement}
        distance=${this.distance}
        skidding=${this.skidding}
        strategy=${this.hoist?"fixed":"absolute"}
        flip
        shift
        auto-size="vertical"
        auto-size-padding="10"
        sync=${pe(this.sync?this.sync:void 0)}
        class=${Ce({dropdown:!0,"dropdown--open":this.open})}
      >
        <slot
          name="trigger"
          slot="anchor"
          part="trigger"
          class="dropdown__trigger"
          @click=${this.handleTriggerClick}
          @keydown=${this.handleTriggerKeyDown}
          @keyup=${this.handleTriggerKeyUp}
          @slotchange=${this.handleTriggerSlotChange}
        ></slot>

        <div aria-hidden=${this.open?"false":"true"} aria-labelledby="dropdown">
          <slot part="panel" class="dropdown__panel"></slot>
        </div>
      </sl-popup>
    `}};wt.styles=[ze,eb];wt.dependencies={"sl-popup":Le};E([le(".dropdown")],wt.prototype,"popup",2);E([le(".dropdown__trigger")],wt.prototype,"trigger",2);E([le(".dropdown__panel")],wt.prototype,"panel",2);E([k({type:Boolean,reflect:!0})],wt.prototype,"open",2);E([k({reflect:!0})],wt.prototype,"placement",2);E([k({type:Boolean,reflect:!0})],wt.prototype,"disabled",2);E([k({attribute:"stay-open-on-select",type:Boolean,reflect:!0})],wt.prototype,"stayOpenOnSelect",2);E([k({attribute:!1})],wt.prototype,"containingElement",2);E([k({type:Number})],wt.prototype,"distance",2);E([k({type:Number})],wt.prototype,"skidding",2);E([k({type:Boolean})],wt.prototype,"hoist",2);E([k({reflect:!0})],wt.prototype,"sync",2);E([we("open",{waitUntilFirstUpdate:!0})],wt.prototype,"handleOpenChange",1);At("dropdown.show",{keyframes:[{opacity:0,scale:.9},{opacity:1,scale:1}],options:{duration:100,easing:"ease"}});At("dropdown.hide",{keyframes:[{opacity:1,scale:1},{opacity:0,scale:.9}],options:{duration:100,easing:"ease"}});wt.define("sl-dropdown");var tb=ee`
  :host {
    display: block;
    position: relative;
    background: var(--sl-panel-background-color);
    border: solid var(--sl-panel-border-width) var(--sl-panel-border-color);
    border-radius: var(--sl-border-radius-medium);
    padding: var(--sl-spacing-x-small) 0;
    overflow: auto;
    overscroll-behavior: none;
  }

  ::slotted(sl-divider) {
    --spacing: var(--sl-spacing-x-small);
  }
`,sc=class extends Ae{connectedCallback(){super.connectedCallback(),this.setAttribute("role","menu")}handleClick(e){const t=["menuitem","menuitemcheckbox"],i=e.composedPath(),s=i.find(a=>{var c;return t.includes(((c=a==null?void 0:a.getAttribute)==null?void 0:c.call(a,"role"))||"")});if(!s||i.find(a=>{var c;return((c=a==null?void 0:a.getAttribute)==null?void 0:c.call(a,"role"))==="menu"})!==this)return;const o=s;o.type==="checkbox"&&(o.checked=!o.checked),this.emit("sl-select",{detail:{item:o}})}handleKeyDown(e){if(e.key==="Enter"||e.key===" "){const t=this.getCurrentItem();e.preventDefault(),e.stopPropagation(),t==null||t.click()}else if(["ArrowDown","ArrowUp","Home","End"].includes(e.key)){const t=this.getAllItems(),i=this.getCurrentItem();let s=i?t.indexOf(i):0;t.length>0&&(e.preventDefault(),e.stopPropagation(),e.key==="ArrowDown"?s++:e.key==="ArrowUp"?s--:e.key==="Home"?s=0:e.key==="End"&&(s=t.length-1),s<0&&(s=t.length-1),s>t.length-1&&(s=0),this.setCurrentItem(t[s]),t[s].focus())}}handleMouseDown(e){const t=e.target;this.isMenuItem(t)&&this.setCurrentItem(t)}handleSlotChange(){const e=this.getAllItems();e.length>0&&this.setCurrentItem(e[0])}isMenuItem(e){var t;return e.tagName.toLowerCase()==="sl-menu-item"||["menuitem","menuitemcheckbox","menuitemradio"].includes((t=e.getAttribute("role"))!=null?t:"")}getAllItems(){return[...this.defaultSlot.assignedElements({flatten:!0})].filter(e=>!(e.inert||!this.isMenuItem(e)))}getCurrentItem(){return this.getAllItems().find(e=>e.getAttribute("tabindex")==="0")}setCurrentItem(e){this.getAllItems().forEach(i=>{i.setAttribute("tabindex",i===e?"0":"-1")})}render(){return T`
      <slot
        @slotchange=${this.handleSlotChange}
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
        @mousedown=${this.handleMouseDown}
      ></slot>
    `}};sc.styles=[ze,tb];E([le("slot")],sc.prototype,"defaultSlot",2);sc.define("sl-menu");var ib=ee`
  :host {
    --submenu-offset: -2px;

    display: block;
  }

  :host([inert]) {
    display: none;
  }

  .menu-item {
    position: relative;
    display: flex;
    align-items: stretch;
    font-family: var(--sl-font-sans);
    font-size: var(--sl-font-size-medium);
    font-weight: var(--sl-font-weight-normal);
    line-height: var(--sl-line-height-normal);
    letter-spacing: var(--sl-letter-spacing-normal);
    color: var(--sl-color-neutral-700);
    padding: var(--sl-spacing-2x-small) var(--sl-spacing-2x-small);
    transition: var(--sl-transition-fast) fill;
    user-select: none;
    -webkit-user-select: none;
    white-space: nowrap;
    cursor: pointer;
  }

  .menu-item.menu-item--disabled {
    outline: none;
    opacity: 0.5;
    cursor: not-allowed;
  }

  .menu-item.menu-item--loading {
    outline: none;
    cursor: wait;
  }

  .menu-item.menu-item--loading *:not(sl-spinner) {
    opacity: 0.5;
  }

  .menu-item--loading sl-spinner {
    --indicator-color: currentColor;
    --track-width: 1px;
    position: absolute;
    font-size: 0.75em;
    top: calc(50% - 0.5em);
    left: 0.65rem;
    opacity: 1;
  }

  .menu-item .menu-item__label {
    flex: 1 1 auto;
    display: inline-block;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  .menu-item .menu-item__prefix {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
  }

  .menu-item .menu-item__prefix::slotted(*) {
    margin-inline-end: var(--sl-spacing-x-small);
  }

  .menu-item .menu-item__suffix {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
  }

  .menu-item .menu-item__suffix::slotted(*) {
    margin-inline-start: var(--sl-spacing-x-small);
  }

  /* Safe triangle */
  .menu-item--submenu-expanded::after {
    content: '';
    position: fixed;
    z-index: calc(var(--sl-z-index-dropdown) - 1);
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    clip-path: polygon(
      var(--safe-triangle-cursor-x, 0) var(--safe-triangle-cursor-y, 0),
      var(--safe-triangle-submenu-start-x, 0) var(--safe-triangle-submenu-start-y, 0),
      var(--safe-triangle-submenu-end-x, 0) var(--safe-triangle-submenu-end-y, 0)
    );
  }

  :host(:focus-visible) {
    outline: none;
  }

  :host(:hover:not([aria-disabled='true'], :focus-visible)) .menu-item,
  .menu-item--submenu-expanded {
    background-color: var(--sl-color-neutral-100);
    color: var(--sl-color-neutral-1000);
  }

  :host(:focus-visible) .menu-item {
    outline: none;
    background-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
    opacity: 1;
  }

  .menu-item .menu-item__check,
  .menu-item .menu-item__chevron {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5em;
    visibility: hidden;
  }

  .menu-item--checked .menu-item__check,
  .menu-item--has-submenu .menu-item__chevron {
    visibility: visible;
  }

  /* Add elevation and z-index to submenus */
  sl-popup::part(popup) {
    box-shadow: var(--sl-shadow-large);
    z-index: var(--sl-z-index-dropdown);
    margin-left: var(--submenu-offset);
  }

  .menu-item--rtl sl-popup::part(popup) {
    margin-left: calc(-1 * var(--submenu-offset));
  }

  @media (forced-colors: active) {
    :host(:hover:not([aria-disabled='true'])) .menu-item,
    :host(:focus-visible) .menu-item {
      outline: dashed 1px SelectedItem;
      outline-offset: -1px;
    }
  }

  ::slotted(sl-menu) {
    max-width: var(--auto-size-available-width) !important;
    max-height: var(--auto-size-available-height) !important;
  }
`;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Rr=(e,t)=>{var s;const i=e._$AN;if(i===void 0)return!1;for(const r of i)(s=r._$AO)==null||s.call(r,t,!1),Rr(r,t);return!0},Rn=e=>{let t,i;do{if((t=e._$AM)===void 0)break;i=t._$AN,i.delete(e),e=t}while((i==null?void 0:i.size)===0)},bp=e=>{for(let t;t=e._$AM;e=t){let i=t._$AN;if(i===void 0)t._$AN=i=new Set;else if(i.has(e))break;i.add(e),nb(t)}};function sb(e){this._$AN!==void 0?(Rn(this),this._$AM=e,bp(this)):this._$AM=e}function rb(e,t=!1,i=0){const s=this._$AH,r=this._$AN;if(r!==void 0&&r.size!==0)if(t)if(Array.isArray(s))for(let n=i;n<s.length;n++)Rr(s[n],!1),Rn(s[n]);else s!=null&&(Rr(s,!1),Rn(s));else Rr(this,e)}const nb=e=>{e.type==Li.CHILD&&(e._$AP??(e._$AP=rb),e._$AQ??(e._$AQ=sb))};class ob extends Xn{constructor(){super(...arguments),this._$AN=void 0}_$AT(t,i,s){super._$AT(t,i,s),bp(this),this.isConnected=t._$AU}_$AO(t,i=!0){var s,r;t!==this.isConnected&&(this.isConnected=t,t?(s=this.reconnected)==null||s.call(this):(r=this.disconnected)==null||r.call(this)),i&&(Rr(this,t),Rn(this))}setValue(t){if(Qh(this._$Ct))this._$Ct._$AI(t,this);else{const i=[...this._$Ct._$AH];i[this._$Ci]=t,this._$Ct._$AI(i,this,0)}}disconnected(){}reconnected(){}}/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ab=()=>new lb;class lb{}const $o=new WeakMap,cb=Kn(class extends ob{render(e){return Z}update(e,[t]){var s;const i=t!==this.G;return i&&this.G!==void 0&&this.rt(void 0),(i||this.lt!==this.ct)&&(this.G=t,this.ht=(s=e.options)==null?void 0:s.host,this.rt(this.ct=e.element)),Z}rt(e){if(this.isConnected||(e=void 0),typeof this.G=="function"){const t=this.ht??globalThis;let i=$o.get(t);i===void 0&&(i=new WeakMap,$o.set(t,i)),i.get(this.G)!==void 0&&this.G.call(this.ht,void 0),i.set(this.G,e),e!==void 0&&this.G.call(this.ht,e)}else this.G.value=e}get lt(){var e,t;return typeof this.G=="function"?(e=$o.get(this.ht??globalThis))==null?void 0:e.get(this.G):(t=this.G)==null?void 0:t.value}disconnected(){this.lt===this.ct&&this.rt(void 0)}reconnected(){this.rt(this.ct)}});var db=class{constructor(e,t){this.popupRef=ab(),this.enableSubmenuTimer=-1,this.isConnected=!1,this.isPopupConnected=!1,this.skidding=0,this.submenuOpenDelay=100,this.handleMouseMove=i=>{this.host.style.setProperty("--safe-triangle-cursor-x",`${i.clientX}px`),this.host.style.setProperty("--safe-triangle-cursor-y",`${i.clientY}px`)},this.handleMouseOver=()=>{this.hasSlotController.test("submenu")&&this.enableSubmenu()},this.handleKeyDown=i=>{switch(i.key){case"Escape":case"Tab":this.disableSubmenu();break;case"ArrowLeft":i.target!==this.host&&(i.preventDefault(),i.stopPropagation(),this.host.focus(),this.disableSubmenu());break;case"ArrowRight":case"Enter":case" ":this.handleSubmenuEntry(i);break}},this.handleClick=i=>{var s;i.target===this.host?(i.preventDefault(),i.stopPropagation()):i.target instanceof Element&&(i.target.tagName==="sl-menu-item"||(s=i.target.role)!=null&&s.startsWith("menuitem"))&&this.disableSubmenu()},this.handleFocusOut=i=>{i.relatedTarget&&i.relatedTarget instanceof Element&&this.host.contains(i.relatedTarget)||this.disableSubmenu()},this.handlePopupMouseover=i=>{i.stopPropagation()},this.handlePopupReposition=()=>{const i=this.host.renderRoot.querySelector("slot[name='submenu']"),s=i==null?void 0:i.assignedElements({flatten:!0}).filter(d=>d.localName==="sl-menu")[0],r=getComputedStyle(this.host).direction==="rtl";if(!s)return;const{left:n,top:o,width:a,height:c}=s.getBoundingClientRect();this.host.style.setProperty("--safe-triangle-submenu-start-x",`${r?n+a:n}px`),this.host.style.setProperty("--safe-triangle-submenu-start-y",`${o}px`),this.host.style.setProperty("--safe-triangle-submenu-end-x",`${r?n+a:n}px`),this.host.style.setProperty("--safe-triangle-submenu-end-y",`${o+c}px`)},(this.host=e).addController(this),this.hasSlotController=t}hostConnected(){this.hasSlotController.test("submenu")&&!this.host.disabled&&this.addListeners()}hostDisconnected(){this.removeListeners()}hostUpdated(){this.hasSlotController.test("submenu")&&!this.host.disabled?(this.addListeners(),this.updateSkidding()):this.removeListeners()}addListeners(){this.isConnected||(this.host.addEventListener("mousemove",this.handleMouseMove),this.host.addEventListener("mouseover",this.handleMouseOver),this.host.addEventListener("keydown",this.handleKeyDown),this.host.addEventListener("click",this.handleClick),this.host.addEventListener("focusout",this.handleFocusOut),this.isConnected=!0),this.isPopupConnected||this.popupRef.value&&(this.popupRef.value.addEventListener("mouseover",this.handlePopupMouseover),this.popupRef.value.addEventListener("sl-reposition",this.handlePopupReposition),this.isPopupConnected=!0)}removeListeners(){this.isConnected&&(this.host.removeEventListener("mousemove",this.handleMouseMove),this.host.removeEventListener("mouseover",this.handleMouseOver),this.host.removeEventListener("keydown",this.handleKeyDown),this.host.removeEventListener("click",this.handleClick),this.host.removeEventListener("focusout",this.handleFocusOut),this.isConnected=!1),this.isPopupConnected&&this.popupRef.value&&(this.popupRef.value.removeEventListener("mouseover",this.handlePopupMouseover),this.popupRef.value.removeEventListener("sl-reposition",this.handlePopupReposition),this.isPopupConnected=!1)}handleSubmenuEntry(e){const t=this.host.renderRoot.querySelector("slot[name='submenu']");if(!t){console.error("Cannot activate a submenu if no corresponding menuitem can be found.",this);return}let i=null;for(const s of t.assignedElements())if(i=s.querySelectorAll("sl-menu-item, [role^='menuitem']"),i.length!==0)break;if(!(!i||i.length===0)){i[0].setAttribute("tabindex","0");for(let s=1;s!==i.length;++s)i[s].setAttribute("tabindex","-1");this.popupRef.value&&(e.preventDefault(),e.stopPropagation(),this.popupRef.value.active?i[0]instanceof HTMLElement&&i[0].focus():(this.enableSubmenu(!1),this.host.updateComplete.then(()=>{i[0]instanceof HTMLElement&&i[0].focus()}),this.host.requestUpdate()))}}setSubmenuState(e){this.popupRef.value&&this.popupRef.value.active!==e&&(this.popupRef.value.active=e,this.host.requestUpdate())}enableSubmenu(e=!0){e?(window.clearTimeout(this.enableSubmenuTimer),this.enableSubmenuTimer=window.setTimeout(()=>{this.setSubmenuState(!0)},this.submenuOpenDelay)):this.setSubmenuState(!0)}disableSubmenu(){window.clearTimeout(this.enableSubmenuTimer),this.setSubmenuState(!1)}updateSkidding(){var e;if(!((e=this.host.parentElement)!=null&&e.computedStyleMap))return;const t=this.host.parentElement.computedStyleMap(),s=["padding-top","border-top-width","margin-top"].reduce((r,n)=>{var o;const a=(o=t.get(n))!=null?o:new CSSUnitValue(0,"px"),d=(a instanceof CSSUnitValue?a:new CSSUnitValue(0,"px")).to("px");return r-d.value},0);this.skidding=s}isExpanded(){return this.popupRef.value?this.popupRef.value.active:!1}renderSubmenu(){const e=getComputedStyle(this.host).direction==="rtl";return this.isConnected?T`
      <sl-popup
        ${cb(this.popupRef)}
        placement=${e?"left-start":"right-start"}
        anchor="anchor"
        flip
        flip-fallback-strategy="best-fit"
        skidding="${this.skidding}"
        strategy="fixed"
        auto-size="vertical"
        auto-size-padding="10"
      >
        <slot name="submenu"></slot>
      </sl-popup>
    `:T` <slot name="submenu" hidden></slot> `}},jt=class extends Ae{constructor(){super(...arguments),this.localize=new Ot(this),this.type="normal",this.checked=!1,this.value="",this.loading=!1,this.disabled=!1,this.hasSlotController=new Ci(this,"submenu"),this.submenuController=new db(this,this.hasSlotController),this.handleHostClick=e=>{this.disabled&&(e.preventDefault(),e.stopImmediatePropagation())},this.handleMouseOver=e=>{this.focus(),e.stopPropagation()}}connectedCallback(){super.connectedCallback(),this.addEventListener("click",this.handleHostClick),this.addEventListener("mouseover",this.handleMouseOver)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("click",this.handleHostClick),this.removeEventListener("mouseover",this.handleMouseOver)}handleDefaultSlotChange(){const e=this.getTextLabel();if(typeof this.cachedTextLabel>"u"){this.cachedTextLabel=e;return}e!==this.cachedTextLabel&&(this.cachedTextLabel=e,this.emit("slotchange",{bubbles:!0,composed:!1,cancelable:!1}))}handleCheckedChange(){if(this.checked&&this.type!=="checkbox"){this.checked=!1,console.error('The checked attribute can only be used on menu items with type="checkbox"',this);return}this.type==="checkbox"?this.setAttribute("aria-checked",this.checked?"true":"false"):this.removeAttribute("aria-checked")}handleDisabledChange(){this.setAttribute("aria-disabled",this.disabled?"true":"false")}handleTypeChange(){this.type==="checkbox"?(this.setAttribute("role","menuitemcheckbox"),this.setAttribute("aria-checked",this.checked?"true":"false")):(this.setAttribute("role","menuitem"),this.removeAttribute("aria-checked"))}getTextLabel(){return pm(this.defaultSlot)}isSubmenu(){return this.hasSlotController.test("submenu")}render(){const e=this.localize.dir()==="rtl",t=this.submenuController.isExpanded();return T`
      <div
        id="anchor"
        part="base"
        class=${Ce({"menu-item":!0,"menu-item--rtl":e,"menu-item--checked":this.checked,"menu-item--disabled":this.disabled,"menu-item--loading":this.loading,"menu-item--has-submenu":this.isSubmenu(),"menu-item--submenu-expanded":t})}
        ?aria-haspopup="${this.isSubmenu()}"
        ?aria-expanded="${!!t}"
      >
        <span part="checked-icon" class="menu-item__check">
          <sl-icon name="check" library="system" aria-hidden="true"></sl-icon>
        </span>

        <slot name="prefix" part="prefix" class="menu-item__prefix"></slot>

        <slot part="label" class="menu-item__label" @slotchange=${this.handleDefaultSlotChange}></slot>

        <slot name="suffix" part="suffix" class="menu-item__suffix"></slot>

        <span part="submenu-icon" class="menu-item__chevron">
          <sl-icon name=${e?"chevron-left":"chevron-right"} library="system" aria-hidden="true"></sl-icon>
        </span>

        ${this.submenuController.renderSubmenu()}
        ${this.loading?T` <sl-spinner part="spinner" exportparts="base:spinner__base"></sl-spinner> `:""}
      </div>
    `}};jt.styles=[ze,ib];jt.dependencies={"sl-icon":pt,"sl-popup":Le,"sl-spinner":Gn};E([le("slot:not([name])")],jt.prototype,"defaultSlot",2);E([le(".menu-item")],jt.prototype,"menuItem",2);E([k()],jt.prototype,"type",2);E([k({type:Boolean,reflect:!0})],jt.prototype,"checked",2);E([k()],jt.prototype,"value",2);E([k({type:Boolean,reflect:!0})],jt.prototype,"loading",2);E([k({type:Boolean,reflect:!0})],jt.prototype,"disabled",2);E([we("checked")],jt.prototype,"handleCheckedChange",1);E([we("disabled")],jt.prototype,"handleDisabledChange",1);E([we("type")],jt.prototype,"handleTypeChange",1);jt.define("sl-menu-item");var ub=Object.defineProperty,hb=Object.getOwnPropertyDescriptor,vp=(e,t,i,s)=>{for(var r=s>1?void 0:s?hb(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&ub(t,i,r),r};let $n=class extends ye{constructor(){super(...arguments),this.status="disconnected"}render(){const{dot:e,label:t}=this.statusDisplay();return T`
      ${e==="spinner"?T`<sl-spinner style="font-size: 0.8rem;"></sl-spinner>`:T`<span class="dot ${e}"></span>`}
      <span class="label">${t}</span>
    `}statusDisplay(){switch(this.status){case"connecting":return{dot:"spinner",label:"Connecting..."};case"syncing":return{dot:"spinner",label:"Loading tasks..."};case"live":return{dot:"green",label:"Live"};case"polling":return{dot:"green",label:"Polling"};case"reconnecting":return{dot:"yellow",label:"Reconnecting..."};case"disconnected":return{dot:"red",label:"Disconnected"};case"error":return{dot:"red",label:"Error"};default:return{dot:"red",label:"Unknown"}}}};$n.styles=ee`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .dot.green { background: var(--ft-stage-completed, #22c55e); }
    .dot.yellow { background: var(--ft-priority-high, #f97316); }
    .dot.red { background: var(--ft-stage-blocked, #ef4444); }
    .label {
      font-size: 0.8rem;
      color: var(--sl-color-neutral-500);
    }
  `;vp([k()],$n.prototype,"status",2);$n=vp([Oe("ft-connection-badge")],$n);const pb="modulepreload",fb=function(e){return"/"+e},md={},mb=function(t,i,s){let r=Promise.resolve();if(i&&i.length>0){let o=function(d){return Promise.all(d.map(l=>Promise.resolve(l).then(u=>({status:"fulfilled",value:u}),u=>({status:"rejected",reason:u}))))};document.getElementsByTagName("link");const a=document.querySelector("meta[property=csp-nonce]"),c=(a==null?void 0:a.nonce)||(a==null?void 0:a.getAttribute("nonce"));r=o(i.map(d=>{if(d=fb(d),d in md)return;md[d]=!0;const l=d.endsWith(".css"),u=l?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${d}"]${u}`))return;const p=document.createElement("link");if(p.rel=l?"stylesheet":pb,l||(p.as="script"),p.crossOrigin="",p.href=d,c&&p.setAttribute("nonce",c),document.head.appendChild(p),l)return new Promise((h,g)=>{p.addEventListener("load",h),p.addEventListener("error",()=>g(new Error(`Unable to preload CSS for ${d}`)))})}))}function n(o){const a=new Event("vite:preloadError",{cancelable:!0});if(a.payload=o,window.dispatchEvent(a),!a.defaultPrevented)throw o}return r.then(o=>{for(const a of o||[])a.status==="rejected"&&n(a.reason);return t().catch(n)})};var gb=Object.defineProperty,bb=Object.getOwnPropertyDescriptor,ro=(e,t,i,s)=>{for(var r=s>1?void 0:s?bb(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&gb(t,i,r),r};const vb=mb(()=>Promise.resolve().then(()=>O0),void 0);vb.then(e=>e.default.setConfig({ADD_TAGS:["script"],ADD_ATTR:["onerror"]}));let Zs=class extends ye{constructor(){super(...arguments),this.icon="inbox",this.heading="",this.subtitle=""}connectedCallback(){super.connectedCallback(),this.setAttribute("role","status")}render(){return T`
      <sl-icon name=${this.icon} aria-hidden="true"></sl-icon>
      <span class="heading">${this.heading}</span>
      ${this.subtitle?T`<span class="subtitle">${this.subtitle}</span>`:Z}
    `}};Zs.styles=ee`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 0.75rem;
    }
    sl-icon {
      font-size: 48px;
      color: var(--icon-color, var(--sl-color-neutral-400));
    }
    .heading {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--sl-color-neutral-600);
    }
    .subtitle {
      font-size: 0.875rem;
      color: var(--sl-color-neutral-500);
    }
  `;ro([k()],Zs.prototype,"icon",2);ro([k()],Zs.prototype,"heading",2);ro([k()],Zs.prototype,"subtitle",2);Zs=ro([Oe("ft-empty-state")],Zs);var ke=(e=>(e[e.UNSPECIFIED=0]="UNSPECIFIED",e[e.FARMTABLE=1]="FARMTABLE",e[e.GITHUB=2]="GITHUB",e[e.LINEAR=3]="LINEAR",e[e.JIRA=4]="JIRA",e[e.ASANA=5]="ASANA",e[e.BEADS=6]="BEADS",e))(ke||{}),ne=(e=>(e[e.UNSPECIFIED=0]="UNSPECIFIED",e[e.OPEN=1]="OPEN",e[e.IN_PROGRESS=2]="IN_PROGRESS",e[e.ON_HOLD=3]="ON_HOLD",e[e.CLOSED=4]="CLOSED",e))(ne||{}),W=(e=>(e[e.UNSPECIFIED=0]="UNSPECIFIED",e[e.TRIAGE=1]="TRIAGE",e[e.ACCEPTED=2]="ACCEPTED",e[e.WORKING=4]="WORKING",e[e.IN_REVIEW=5]="IN_REVIEW",e[e.IN_QA=6]="IN_QA",e[e.DEPLOYING=7]="DEPLOYING",e[e.COMPLETED=12]="COMPLETED",e[e.WONT_FIX=13]="WONT_FIX",e[e.DUPLICATE=14]="DUPLICATE",e[e.CANCELLED=15]="CANCELLED",e))(W||{}),Q=(e=>(e[e.UNSPECIFIED=0]="UNSPECIFIED",e[e.URGENT=1]="URGENT",e[e.HIGH=2]="HIGH",e[e.NORMAL=3]="NORMAL",e[e.LOW=4]="LOW",e))(Q||{}),fe=(e=>(e[e.UNSPECIFIED=0]="UNSPECIFIED",e[e.BLOCKS=1]="BLOCKS",e[e.BLOCKED_BY=2]="BLOCKED_BY",e[e.RELATED=3]="RELATED",e[e.DUPLICATE=4]="DUPLICATE",e))(fe||{}),Pt=(e=>(e[e.UNSPECIFIED=0]="UNSPECIFIED",e[e.HUMAN=1]="HUMAN",e[e.AGENT=2]="AGENT",e[e.SERVICE_ACCOUNT=3]="SERVICE_ACCOUNT",e))(Pt||{}),Mt=(e=>(e[e.UNSPECIFIED=0]="UNSPECIFIED",e[e.ACTIVE=1]="ACTIVE",e[e.SUSPENDED=2]="SUSPENDED",e[e.ARCHIVED=3]="ARCHIVED",e))(Mt||{}),_i=(e=>(e[e.UNSPECIFIED=0]="UNSPECIFIED",e[e.PENDING=1]="PENDING",e[e.RUNNING=2]="RUNNING",e[e.PASSED=3]="PASSED",e[e.FAILED=4]="FAILED",e))(_i||{}),ws=(e=>(e[e.UNSPECIFIED=0]="UNSPECIFIED",e[e.OPEN=1]="OPEN",e[e.MERGED=2]="MERGED",e[e.CLOSED=3]="CLOSED",e))(ws||{}),yp=(e=>(e[e.UNSPECIFIED=0]="UNSPECIFIED",e[e.ASC=1]="ASC",e[e.DESC=2]="DESC",e))(yp||{}),En=(e=>(e[e.UNSPECIFIED=0]="UNSPECIFIED",e[e.INITIAL=1]="INITIAL",e[e.CREATED=2]="CREATED",e[e.UPDATED=3]="UPDATED",e[e.CLOSED=4]="CLOSED",e[e.DELETED=5]="DELETED",e[e.HEARTBEAT=6]="HEARTBEAT",e[e.SNAPSHOT_COMPLETE=7]="SNAPSHOT_COMPLETE",e))(En||{});function Es(e){switch(e){case ke.FARMTABLE:return"Farm Table";case ke.GITHUB:return"GitHub";case ke.LINEAR:return"Linear";case ke.JIRA:return"Jira";case ke.ASANA:return"Asana";case ke.BEADS:return"Beads";default:return"Unknown platform"}}function Pl(e){switch(e){case ke.FARMTABLE:return"table";case ke.GITHUB:return"github";case ke.LINEAR:return"lightning";case ke.JIRA:return"kanban";case ke.ASANA:return"clipboard-check";case ke.BEADS:return"circle";default:return"globe"}}function yb(e,t,i){return t!==ke.FARMTABLE&&i?`${Es(t)}: ${i}`:e}const rc="__unassigned";function Dn(e,t,i){return t!==null&&e.phase!==t?!1:i?i===rc?e.assignees.length===0:e.assignees.some(s=>s.id===i):!0}var wb=Object.defineProperty,_b=Object.getOwnPropertyDescriptor,rr=(e,t,i,s)=>{for(var r=s>1?void 0:s?_b(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&wb(t,i,r),r};let is=class extends ye{constructor(){super(...arguments),this.collectionId="",this.collections=[],this.isLoading=!1,this.loadError="",this.loadToken=0}updated(e){e.has("client")&&this.client!==e.get("client")&&this.loadCollections()}async refresh(){await this.loadCollections()}render(){const e=this.collections.find(s=>s.id===this.collectionId),t=e?yb(e.name,e.platform,e.remoteId):this.isLoading?"Loading collection":"Select collection",i=e?Pl(e.platform):null;return T`
      <sl-dropdown placement="bottom-start" hoist>
        <sl-button slot="trigger" size="small" caret>
          ${i?T`<sl-icon name=${i} slot="prefix" class="platform-icon"></sl-icon>`:null}
          <span class="trigger-label">${t}</span>
        </sl-button>

        <sl-menu @sl-select=${this.onMenuSelect}>
          ${this.renderMenuContent()}
        </sl-menu>
      </sl-dropdown>
    `}renderMenuContent(){return this.isLoading?T`<div class="loading"><sl-spinner></sl-spinner> Loading collections</div>`:this.loadError?T`<div class="error">${this.loadError}</div>`:this.collections.length===0?T`<div class="empty">No collections are available.</div>`:this.collections.map(e=>{const t=e.id===this.collectionId,i=e.platform!==ke.FARMTABLE;return T`
        <sl-menu-item
          class=${t?"current":""}
          value=${e.id}
        >
          <sl-icon
            slot="prefix"
            class=${t?"check-icon":"check-icon placeholder"}
            name="check"
            aria-hidden="true"
          ></sl-icon>
          <span class="item-label">
            <span class="name">${e.name}</span>
            <span class=${i?"external-badge":"platform"}>
              <sl-icon name=${Pl(e.platform)} aria-hidden="true"></sl-icon>
              ${i&&e.remoteId?T`${Es(e.platform)}: ${e.remoteId}`:Es(e.platform)}
            </span>
          </span>
        </sl-menu-item>
      `})}async loadCollections(){const e=++this.loadToken;if(!this.client){this.collections=[],this.isLoading=!1,this.loadError="";return}this.isLoading=!0,this.loadError="";try{const t=await this.client.listCollections();e===this.loadToken&&(this.collections=t)}catch(t){e===this.loadToken&&(this.collections=[],this.loadError="Unable to load collections."),console.warn("Failed to load collection picker options",t)}finally{e===this.loadToken&&(this.isLoading=!1)}}onMenuSelect(e){const t=e.detail.item.value;!t||t===this.collectionId||this.dispatchEvent(new CustomEvent("collection-select",{detail:{collectionId:t},bubbles:!0,composed:!0}))}};is.styles=ee`
    :host {
      --sl-z-index-dropdown: 2000;

      display: inline-flex;
      align-items: center;
      max-width: 18rem;
      position: relative;
    }

    sl-dropdown,
    sl-button {
      max-width: 100%;
    }

    sl-dropdown::part(base__popup) {
      z-index: var(--sl-z-index-dropdown, 1000);
    }

    sl-dropdown::part(panel) {
      background: var(--sl-color-neutral-0);
      border-radius: var(--sl-border-radius-medium);
      box-shadow: var(--sl-shadow-medium);
    }

    .trigger-label {
      display: inline-block;
      max-width: 13rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    sl-menu {
      background: var(--sl-color-neutral-0);
      border: 1px solid var(--sl-color-neutral-200);
      box-shadow: var(--sl-shadow-medium);
      min-width: 16rem;
      max-width: 22rem;
    }

    sl-menu-item::part(base) {
      align-items: center;
      background: var(--sl-color-neutral-0);
      padding: 0.5rem 0.75rem;
      white-space: normal;
    }

    sl-menu-item::part(label) {
      overflow: visible;
    }

    sl-menu-item.current::part(base) {
      background: var(--sl-color-primary-50);
      color: var(--sl-color-primary-800);
    }

    .item-label {
      display: flex;
      flex-direction: column;
      min-width: 0;
      line-height: 1.25;
    }

    .check-icon {
      color: var(--sl-color-primary-700);
      font-size: 1rem;
    }

    .check-icon.placeholder {
      visibility: hidden;
    }

    .platform-icon {
      font-size: 1rem;
      color: var(--sl-color-neutral-600);
    }

    .name {
      overflow-wrap: anywhere;
    }

    .platform {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--sl-color-neutral-600);
      font-size: var(--sl-font-size-x-small);
    }

    .platform sl-icon {
      font-size: 0.7rem;
    }

    .external-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--sl-color-neutral-600);
      font-size: var(--sl-font-size-x-small);
    }

    .external-badge sl-icon {
      font-size: 0.7rem;
    }

    .loading,
    .empty,
    .error {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      color: var(--sl-color-neutral-600);
      font-size: var(--sl-font-size-small);
    }

    .error {
      color: var(--sl-color-danger-700);
    }
  `;rr([k({attribute:!1})],is.prototype,"client",2);rr([k()],is.prototype,"collectionId",2);rr([U()],is.prototype,"collections",2);rr([U()],is.prototype,"isLoading",2);rr([U()],is.prototype,"loadError",2);is=rr([Oe("ft-collection-picker")],is);var kb=Object.defineProperty,Eb=Object.getOwnPropertyDescriptor,Kr=(e,t,i,s)=>{for(var r=s>1?void 0:s?Eb(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&kb(t,i,r),r};let xs=class extends ye{constructor(){super(...arguments),this.isCreating=!1,this.errorMessage=""}async show(){await this.updateComplete,await this.dialog.show(),this.nameInput.focus()}close(){this.dialog.hide()}setCreating(e){this.isCreating=e}setError(e){this.errorMessage=e}onCancel(){this.isCreating||this.close()}onCreateClick(){var e;(e=this.renderRoot.querySelector("form"))==null||e.requestSubmit()}onSubmit(e){e.preventDefault();const t=this.nameInput.value.trim();this.nameInput.value=t,this.nameInput.reportValidity()&&(this.errorMessage="",this.dispatchEvent(new CustomEvent("collection-create",{detail:{name:t},bubbles:!0,composed:!0})))}onAfterHide(){this.isCreating=!1,this.errorMessage="",this.nameInput.value=""}onRequestClose(e){this.isCreating&&e.preventDefault()}render(){return T`
      <sl-dialog
        label="New Collection"
        @sl-after-hide=${this.onAfterHide}
        @sl-request-close=${this.onRequestClose}
      >
        <form id="new-collection-form" @submit=${this.onSubmit}>
          ${this.errorMessage?T`
                <sl-alert variant="danger" open>
                  <sl-icon slot="icon" name="exclamation-triangle"></sl-icon>
                  ${this.errorMessage}
                </sl-alert>
              `:null}
          <sl-input
            name="name"
            label="Name"
            required
            maxlength="255"
            autocomplete="off"
            ?disabled=${this.isCreating}
          ></sl-input>
        </form>
        <div class="actions" slot="footer">
          <sl-button ?disabled=${this.isCreating} @click=${this.onCancel}>
            Cancel
          </sl-button>
          <sl-button
            variant="primary"
            ?loading=${this.isCreating}
            ?disabled=${this.isCreating}
            @click=${this.onCreateClick}
          >
            Create
          </sl-button>
        </div>
      </sl-dialog>
    `}};xs.styles=ee`
    form {
      display: grid;
      gap: 1rem;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `;Kr([le("sl-dialog")],xs.prototype,"dialog",2);Kr([le('sl-input[name="name"]')],xs.prototype,"nameInput",2);Kr([U()],xs.prototype,"isCreating",2);Kr([U()],xs.prototype,"errorMessage",2);xs=Kr([Oe("ft-new-collection-dialog")],xs);var xb=Object.defineProperty,Tb=Object.getOwnPropertyDescriptor,Os=(e,t,i,s)=>{for(var r=s>1?void 0:s?Tb(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&xb(t,i,r),r};let zi=class extends ye{constructor(){super(...arguments),this.isSaving=!1,this.errorMessage=""}async show(e){this.collection=e,this.errorMessage="",await this.updateComplete,this.nameInput.value=e.name,this.descriptionTextarea.value=e.description??"",await this.dialog.show(),this.nameInput.focus()}close(){this.dialog.hide()}setSaving(e){this.isSaving=e}setError(e){this.errorMessage=e}onCancel(){this.isSaving||this.close()}onSaveClick(){var e;(e=this.renderRoot.querySelector("form"))==null||e.requestSubmit()}onSubmit(e){if(e.preventDefault(),!this.collection)return;const t=this.nameInput.value.trim(),i=this.descriptionTextarea.value.trim();this.nameInput.value=t,this.nameInput.reportValidity()&&(this.errorMessage="",this.dispatchEvent(new CustomEvent("collection-update",{detail:{id:this.collection.id,name:t,description:i},bubbles:!0,composed:!0})))}onAfterHide(){this.isSaving=!1,this.errorMessage="",this.collection=void 0}onRequestClose(e){this.isSaving&&e.preventDefault()}render(){var e,t;return T`
      <sl-dialog
        label="Collection Settings"
        @sl-after-hide=${this.onAfterHide}
        @sl-request-close=${this.onRequestClose}
      >
        <form id="collection-settings-form" @submit=${this.onSubmit}>
          ${this.errorMessage?T`
                <sl-alert variant="danger" open>
                  <sl-icon slot="icon" name="exclamation-triangle"></sl-icon>
                  ${this.errorMessage}
                </sl-alert>
              `:null}
          <sl-input
            name="name"
            label="Name"
            required
            maxlength="255"
            autocomplete="off"
            value=${((e=this.collection)==null?void 0:e.name)??""}
            ?disabled=${this.isSaving}
          ></sl-input>
          <sl-textarea
            name="description"
            label="Description"
            value=${((t=this.collection)==null?void 0:t.description)??""}
            ?disabled=${this.isSaving}
          ></sl-textarea>
          <div class="platform-field">
            <span class="platform-label">Platform</span>
            <span class="platform-value">${this.collection?Es(this.collection.platform):""}</span>
          </div>
        </form>
        <div class="actions" slot="footer">
          <sl-button ?disabled=${this.isSaving} @click=${this.onCancel}>
            Cancel
          </sl-button>
          <sl-button
            variant="primary"
            ?loading=${this.isSaving}
            ?disabled=${this.isSaving}
            @click=${this.onSaveClick}
          >
            Save
          </sl-button>
        </div>
      </sl-dialog>
    `}};zi.styles=ee`
    form {
      display: grid;
      gap: 1rem;
    }
    .platform-field {
      display: grid;
      gap: 0.25rem;
    }
    .platform-label {
      color: var(--sl-input-label-color);
      font-size: var(--sl-input-label-font-size-medium);
      font-weight: var(--sl-input-label-font-weight);
    }
    .platform-value {
      min-height: var(--sl-input-height-medium);
      display: flex;
      align-items: center;
      padding: 0 var(--sl-input-spacing-medium);
      border: solid var(--sl-input-border-width) var(--sl-input-border-color);
      border-radius: var(--sl-input-border-radius-medium);
      background: var(--sl-color-neutral-50);
      color: var(--sl-color-neutral-700);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `;Os([le("sl-dialog")],zi.prototype,"dialog",2);Os([le('sl-input[name="name"]')],zi.prototype,"nameInput",2);Os([le('sl-textarea[name="description"]')],zi.prototype,"descriptionTextarea",2);Os([U()],zi.prototype,"collection",2);Os([U()],zi.prototype,"isSaving",2);Os([U()],zi.prototype,"errorMessage",2);zi=Os([Oe("ft-collection-settings-dialog")],zi);var Cb=Object.defineProperty,Sb=Object.getOwnPropertyDescriptor,li=(e,t,i,s)=>{for(var r=s>1?void 0:s?Sb(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&Cb(t,i,r),r};const Ob=50*1024*1024;let Bt=class extends ye{constructor(){super(...arguments),this.file=null,this.detectedFormat=null,this.preview=null,this.collectionName="",this.loading=!1,this.error="",this.fileText=""}async show(){await this.updateComplete,await this.dialog.show()}close(){this.dialog.hide()}onChooseFile(){this.loading||this.fileInput.click()}async onFileChange(){var t,i,s,r;const e=((t=this.fileInput.files)==null?void 0:t[0])??null;if(this.file=e,this.preview=null,this.collectionName="",this.error="",this.fileText="",this.detectedFormat=null,!!e){if(e.size>Ob){this.file=null,this.error="File too large. Maximum import size is 50 MB.",this.fileInput.value="";return}try{const n=await this.readFile(e);if(e.name.endsWith(".jsonl"))this.parseAsBeadsJsonl(n,e.name);else try{const a=JSON.parse(n);if(a.format_version!==1)throw new Error("Unsupported collection export format.");this.detectedFormat="farmtable";const c=this.extractCollectionName(a),d={name:c,tasks:this.countArray(a.tasks??((i=a.collection)==null?void 0:i.tasks)),comments:this.countArray(a.comments??((s=a.collection)==null?void 0:s.comments)),relationships:this.countArray(a.relationships??((r=a.collection)==null?void 0:r.relationships))};this.fileText=n,this.preview=d,this.collectionName=c}catch{this.parseAsBeadsJsonl(n,e.name)}}catch(n){this.file=null,this.preview=null,this.collectionName="",this.fileText="",this.detectedFormat=null,this.error=n instanceof Error?n.message:"Failed to read import file.",this.fileInput.value=""}}}readFile(e){return new Promise((t,i)=>{const s=new FileReader;s.onload=()=>t(typeof s.result=="string"?s.result:""),s.onerror=()=>i(new Error("Failed to read selected file.")),s.readAsText(e)})}extractCollectionName(e){var i;const t=((i=e.collection)==null?void 0:i.name)??e.name;return typeof t=="string"&&t.trim()?t.trim():"Imported Collection"}countArray(e){return Array.isArray(e)?e.length:0}parseAsBeadsJsonl(e,t){const s=e.split(`
`).filter(n=>n.trim().length>0).length;if(s===0)throw new Error("No issues found in JSONL file.");this.detectedFormat="beads";const r=t.replace(/\.(jsonl|json)$/,"");this.fileText=e,this.preview={name:r,tasks:s,comments:0,relationships:0},this.collectionName=r}onNameInput(e){const t=e.currentTarget;this.collectionName=t.value}onCancel(){this.loading||this.close()}async onImportClick(){if(!this.preview||!this.fileText||this.loading)return;if(!this.client){this.error="Service not available. Please reload.";return}const e=this.collectionName.trim();if(this.nameInput.value=e,!!this.nameInput.reportValidity()){this.loading=!0,this.error="";try{const t=new TextEncoder().encode(this.fileText),i=await this.client.importCollection(t,e,!1),s=this.successMessage(i.warnings);this.dispatchEvent(new CustomEvent("collection-import",{detail:{collectionId:i.collectionId,message:s},bubbles:!0,composed:!0}))}catch(t){this.error="Import failed: "+(t instanceof Error?t.message:"Unknown error")}finally{this.loading=!1}}}successMessage(e){return e.length===0?"Collection imported successfully.":"Collection imported with warnings: "+e.join(", ")}onAfterHide(){this.file=null,this.preview=null,this.collectionName="",this.loading=!1,this.error="",this.fileText="",this.detectedFormat=null,this.fileInput&&(this.fileInput.value="")}onRequestClose(e){this.loading&&e.preventDefault()}render(){var e;return T`
      <sl-dialog
        label="Import Collection"
        @sl-after-hide=${this.onAfterHide}
        @sl-request-close=${this.onRequestClose}
      >
        <form id="import-collection-form">
          ${this.error?T`
                <sl-alert variant="danger" open>
                  <sl-icon slot="icon" name="exclamation-triangle"></sl-icon>
                  ${this.error}
                </sl-alert>
              `:null}
          <div class="file-row">
            <input
              type="file"
              accept=".json,.jsonl"
              ?disabled=${this.loading}
              @change=${this.onFileChange}
            >
            <sl-button ?disabled=${this.loading} @click=${this.onChooseFile}>
              Choose File
            </sl-button>
            <span class="file-name">${((e=this.file)==null?void 0:e.name)??"No file selected"}</span>
          </div>
          <div style="color: var(--sl-color-neutral-500); font-size: var(--sl-font-size-small);">
            Supported formats: Farmtable export (.json), Beads issue export (.jsonl)
          </div>
          ${this.preview?T`
                <div class="preview">
                  <div class="preview-title">
                    ${this.detectedFormat==="beads"?`Beads Import: ~${this.preview.tasks} issues (approx)`:`Collection: "${this.preview.name}"`}
                  </div>
                  <div class="preview-counts">
                    <span>${this.detectedFormat==="beads"?"~Issues (approx)":"Tasks"}: ${this.preview.tasks}</span>
                    ${this.detectedFormat!=="beads"?T`
                          <span>Comments: ${this.preview.comments}</span>
                          <span>Relationships: ${this.preview.relationships}</span>
                        `:null}
                  </div>
                </div>
              `:null}
          <sl-input
            name="name"
            label="Collection Name"
            required
            maxlength="255"
            autocomplete="off"
            .value=${this.collectionName}
            ?disabled=${this.loading||!this.preview}
            @sl-input=${this.onNameInput}
          ></sl-input>
        </form>
        <div class="actions" slot="footer">
          <sl-button ?disabled=${this.loading} @click=${this.onCancel}>
            Cancel
          </sl-button>
          <sl-button
            variant="primary"
            ?loading=${this.loading}
            ?disabled=${this.loading||!this.preview}
            @click=${this.onImportClick}
          >
            Import
          </sl-button>
        </div>
      </sl-dialog>
    `}};Bt.styles=ee`
    form {
      display: grid;
      gap: 1rem;
    }
    input[type="file"] {
      display: none;
    }
    .file-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
    }
    .file-name {
      color: var(--sl-color-neutral-700);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .preview {
      display: grid;
      gap: 0.5rem;
      padding: 0.75rem;
      border: 1px solid var(--sl-color-neutral-200);
      border-radius: var(--sl-border-radius-medium);
      background: var(--sl-color-neutral-50);
    }
    .preview-title {
      font-weight: 600;
    }
    .preview-counts {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      color: var(--sl-color-neutral-700);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `;li([k({attribute:!1})],Bt.prototype,"client",2);li([le("sl-dialog")],Bt.prototype,"dialog",2);li([le('input[type="file"]')],Bt.prototype,"fileInput",2);li([le('sl-input[name="name"]')],Bt.prototype,"nameInput",2);li([U()],Bt.prototype,"file",2);li([U()],Bt.prototype,"detectedFormat",2);li([U()],Bt.prototype,"preview",2);li([U()],Bt.prototype,"collectionName",2);li([U()],Bt.prototype,"loading",2);li([U()],Bt.prototype,"error",2);Bt=li([Oe("ft-import-collection-dialog")],Bt);var Ab=Object.defineProperty,Ib=Object.getOwnPropertyDescriptor,je=(e,t,i,s)=>{for(var r=s>1?void 0:s?Ib(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&Ab(t,i,r),r};const Rb=[{value:ne.OPEN,label:"Open"},{value:ne.IN_PROGRESS,label:"In Progress"},{value:ne.ON_HOLD,label:"On Hold"},{value:ne.CLOSED,label:"Closed"}];let qe=class extends ye{constructor(){super(...arguments),this.currentView="kanban",this.connectionStatus="disconnected",this.collectionId="",this.readOnly=!1,this.externalWritable=!1,this.phaseFilter=null,this.assigneeFilter=null,this.isPolling=!1,this.lastRefreshed=null,this.isRefreshing=!1,this.sessionUser=null,this.layoutOrientation="TB",this.isDark=document.documentElement.classList.contains("sl-theme-dark"),this.users=[],this.usersLoading=!1,this.exporting=!1,this.userLoadToken=0,this.collectionLoadToken=0}updated(e){e.has("client")&&this.loadUsers(),(e.has("unscopedClient")||e.has("collectionId"))&&this.loadCurrentCollection()}render(){var t;const e=this.currentView==="tree"||this.currentView==="dashboard"||this.currentView==="dependencies";return T`
      <div class="collection-controls">
        <ft-collection-picker
          .client=${this.unscopedClient}
          .collectionId=${this.collectionId}
          @collection-select=${this.onCollectionSelect}
        ></ft-collection-picker>
        <sl-icon-button
          class="toolbar-icon-button"
          name="plus-circle"
          label="New collection"
          @click=${this.onNewCollectionClick}
        ></sl-icon-button>
        ${((t=this.currentCollection)==null?void 0:t.platform)===ke.FARMTABLE?T`
              <sl-icon-button
                class="toolbar-icon-button"
                name="gear"
                label="Collection settings"
                @click=${this.onCollectionSettingsClick}
              ></sl-icon-button>
              <sl-icon-button
                class="toolbar-icon-button"
                name="download"
                label="Export collection"
                ?loading=${this.exporting}
                @click=${this.onExportClick}
              ></sl-icon-button>
            `:null}
        ${this.currentCollection&&this.currentCollection.platform!==ke.FARMTABLE?this.renderExternalLink(this.currentCollection):null}
        <sl-icon-button
          class="toolbar-icon-button"
          name="upload"
          label="Import collection"
          @click=${this.onImportClick}
        ></sl-icon-button>
        ${this.externalWritable?T`<span class="platform-badge">↔ GitHub</span>`:this.readOnly?T`<span class="read-only-badge"><sl-icon name="lock"></sl-icon>Read-only</span>`:null}
      </div>

      <span class="title">Farm Table</span>

      <div class="filters">
        <sl-select
          placeholder="Phase"
          size="small"
          clearable
          hoist
          value=${this.phaseFilter===null?"":String(this.phaseFilter)}
          ?disabled=${e}
          @sl-change=${this.onPhaseFilterChange}
        >
          ${Rb.map(i=>T`
              <sl-option value=${String(i.value)}>${i.label}</sl-option>
            `)}
        </sl-select>

        <sl-select
          placeholder="Assignee"
          size="small"
          clearable
          hoist
          value=${this.assigneeFilter??""}
          ?disabled=${e}
          @sl-change=${this.onAssigneeFilterChange}
        >
          ${this.usersLoading?T`<sl-option value="" disabled>Loading users...</sl-option>`:null}
          <sl-option value=${rc}>Unassigned</sl-option>
          ${this.users.map(i=>T`
              <sl-option value=${i.id}>${i.name||i.email||i.id}</sl-option>
            `)}
        </sl-select>
      </div>

      <sl-radio-group
        class="view-switcher"
        value=${this.currentView}
        size="small"
        @sl-change=${this.onViewChange}
      >
        <sl-tooltip content="Dashboard view">
          <sl-radio-button value="dashboard" aria-label="Dashboard view">
            <sl-icon name="grid" label="Dashboard view"></sl-icon>
          </sl-radio-button>
        </sl-tooltip>
        <sl-tooltip content="Kanban view">
          <sl-radio-button value="kanban" aria-label="Kanban view">
            <sl-icon name="kanban" label="Kanban view"></sl-icon>
          </sl-radio-button>
        </sl-tooltip>
        <sl-tooltip content="Tree view">
          <sl-radio-button value="tree" aria-label="Tree view">
            <sl-icon name="diagram-3" label="Tree view"></sl-icon>
          </sl-radio-button>
        </sl-tooltip>
        <sl-tooltip content="Dependencies view">
          <sl-radio-button value="dependencies" aria-label="Dependencies view">
            <sl-icon name="diagram-3" label="Dependencies view" style="transform: rotate(90deg)"></sl-icon>
          </sl-radio-button>
        </sl-tooltip>
        <sl-tooltip content="Available Queue">
          <sl-radio-button value="ready-queue" aria-label="Available Queue">
            <sl-icon name="list-check" label="Available Queue"></sl-icon>
          </sl-radio-button>
        </sl-tooltip>
      </sl-radio-group>

      <sl-icon-button
        class="toolbar-icon-button"
        name=${this.isDark?"sun":"moon"}
        label=${this.isDark?"Switch to light mode":"Switch to dark mode"}
        @click=${this.onToggleTheme}
      ></sl-icon-button>

      <sl-icon-button
        class="toolbar-icon-button"
        name="question-circle"
        label="Show keyboard shortcuts"
        @click=${this.onShortcutHelpClick}
      ></sl-icon-button>

      ${this.isPolling?this.renderRefreshControls():null}

      <ft-connection-badge .status=${this.connectionStatus}></ft-connection-badge>

      ${this.sessionUser?T`
        <span class="user-badge">
          <sl-icon name="person-circle"></sl-icon>
          ${this.sessionUser.userName||this.sessionUser.email||"User"}
        </span>
        <sl-tooltip content="Sign out">
          <sl-icon-button
            class="toolbar-icon-button"
            name="box-arrow-right"
            label="Sign out"
            @click=${this.onLogoutClick}
          ></sl-icon-button>
        </sl-tooltip>
      `:null}

      <ft-new-collection-dialog
        @collection-create=${this.onCollectionCreate}
      ></ft-new-collection-dialog>
      <ft-collection-settings-dialog
        @collection-update=${this.onCollectionUpdate}
      ></ft-collection-settings-dialog>
      <ft-import-collection-dialog
        .client=${this.unscopedClient}
        @collection-import=${this.onCollectionImport}
      ></ft-import-collection-dialog>
    `}renderRefreshControls(){return T`
      <div class="refresh-controls">
        <sl-tooltip content="Refresh tasks now">
          <sl-button
            size="small"
            variant="default"
            ?loading=${this.isRefreshing}
            ?disabled=${this.isRefreshing}
            @click=${this.onRefreshClick}
          >
            <sl-icon slot="prefix" name="arrow-clockwise"></sl-icon>
            Refresh
          </sl-button>
        </sl-tooltip>
        ${this.lastRefreshed?T`<span class="last-refreshed">Updated ${this.formatRelativeTime(this.lastRefreshed)}</span>`:null}
      </div>
    `}onRefreshClick(){this.dispatchEvent(new CustomEvent("manual-refresh",{bubbles:!0,composed:!0}))}formatRelativeTime(e){const t=Math.floor((Date.now()-e.getTime())/1e3);if(t<5)return"just now";if(t<60)return`${t}s ago`;const i=Math.floor(t/60);return i<60?`${i}m ago`:e.toLocaleTimeString(void 0,{hour:"2-digit",minute:"2-digit"})}async onNewCollectionClick(){await this.newCollectionDialog.show()}async onCollectionSettingsClick(){if(!(!this.unscopedClient||!this.collectionId))try{const e=this.currentCollection??await this.unscopedClient.getCollection(this.collectionId);await this.collectionSettingsDialog.show(e)}catch(e){console.warn("Failed to load collection settings",e)}}renderExternalLink(e){const t=/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;if(e.platform===ke.GITHUB&&e.remoteId&&t.test(e.remoteId)){const i=`https://github.com/${e.remoteId}`;return T`
        <a href=${i} target="_blank" rel="noopener" class="external-link" title="View on GitHub">
          <sl-icon name="box-arrow-up-right"></sl-icon>
          <span>View on GitHub</span>
        </a>
      `}return e.platform!==ke.FARMTABLE?T`
        <span class="platform-badge">${Es(e.platform)}</span>
      `:null}async onExportClick(){var e;if(!(this.exporting||!this.unscopedClient||!this.collectionId)){this.exporting=!0;try{const t=await this.unscopedClient.exportCollection(this.collectionId,!1),s=(((e=this.currentCollection)==null?void 0:e.name)??"collection").replace(/[^a-zA-Z0-9_-]/g,"-"),r=new Date().toISOString().slice(0,10),n=s+"-"+r+".json",o=new TextDecoder().decode(t.data),a=new Blob([o],{type:"application/json"}),c=URL.createObjectURL(a),d=document.createElement("a");d.href=c,d.download=n,document.body.appendChild(d),d.click(),document.body.removeChild(d),URL.revokeObjectURL(c),t.warnings.length>0&&this.showToast("warning","Export warnings: "+t.warnings.join(", "))}catch(t){this.showToast("danger","Export failed: "+(t instanceof Error?t.message:"Unknown error"))}finally{this.exporting=!1}}}onImportClick(){this.importCollectionDialog.show()}async onCollectionCreate(e){const t=this.newCollectionDialog;if(!this.unscopedClient){t.setError("Service not available. Please reload.");return}t.setError(""),t.setCreating(!0);try{const i=await this.unscopedClient.createCollection(e.detail.name);t.close(),this.dispatchEvent(new CustomEvent("collection-select",{detail:{collectionId:i.id},bubbles:!0,composed:!0}))}catch(i){t.setError("Failed to create collection. Please try again."),console.warn("Failed to create collection",i)}finally{t.setCreating(!1)}}onCollectionImport(e){this.importCollectionDialog.close(),this.showToast("success",e.detail.message),this.dispatchEvent(new CustomEvent("collection-select",{detail:{collectionId:e.detail.collectionId},bubbles:!0,composed:!0}))}async onCollectionUpdate(e){var i;const t=this.collectionSettingsDialog;if(!this.unscopedClient){t.setError("Service not available. Please reload.");return}t.setError(""),t.setSaving(!0);try{const s={};(!this.currentCollection||e.detail.name!==this.currentCollection.name)&&(s.name=e.detail.name),e.detail.description!==(((i=this.currentCollection)==null?void 0:i.description)??"")&&(s.description=e.detail.description);const r=await this.unscopedClient.updateCollection(e.detail.id,s);this.currentCollection=r,t.close(),await this.collectionPicker.refresh()}catch(s){t.setError("Failed to update collection. Please try again."),console.warn("Failed to update collection",s)}finally{t.setSaving(!1)}}async loadCurrentCollection(){const e=++this.collectionLoadToken;if(!this.unscopedClient||!this.collectionId){this.currentCollection=void 0;return}try{const t=await this.unscopedClient.getCollection(this.collectionId);e===this.collectionLoadToken&&(this.currentCollection=t)}catch(t){e===this.collectionLoadToken&&(this.currentCollection=void 0),console.warn("Failed to load current collection for toolbar",t)}}onToggleTheme(){this.isDark=!this.isDark,document.documentElement.classList.toggle("sl-theme-dark",this.isDark),localStorage.setItem("ft-theme",this.isDark?"dark":"light")}onViewChange(e){const t=e.target;this.dispatchEvent(new CustomEvent("view-change",{detail:{view:t.value},bubbles:!0,composed:!0}))}onCollectionSelect(e){e.stopPropagation(),this.dispatchEvent(new CustomEvent("collection-select",{detail:e.detail,bubbles:!0,composed:!0}))}async loadUsers(){const e=++this.userLoadToken;if(!this.client){this.users=[],this.usersLoading=!1;return}this.usersLoading=!0;try{const t=await this.client.listUsers();e===this.userLoadToken&&(this.users=t,this.usersLoading=!1)}catch(t){e===this.userLoadToken&&(this.users=[],this.usersLoading=!1),console.warn("Failed to load toolbar assignee filters",t)}}onPhaseFilterChange(e){const t=this.selectValue(e);this.dispatchFilterChange({phase:t?Number(t):null,assigneeId:this.assigneeFilter})}onAssigneeFilterChange(e){const t=this.selectValue(e);this.dispatchFilterChange({phase:this.phaseFilter,assigneeId:t||null})}selectValue(e){const t=e.currentTarget;return Array.isArray(t.value)?t.value[0]??"":t.value}dispatchFilterChange(e){this.dispatchEvent(new CustomEvent("filter-change",{detail:e,bubbles:!0,composed:!0}))}onShortcutHelpClick(){this.dispatchEvent(new CustomEvent("shortcut-help-open",{bubbles:!0,composed:!0}))}onLogoutClick(){this.dispatchEvent(new CustomEvent("logout",{bubbles:!0,composed:!0}))}showToast(e,t){const i=Object.assign(document.createElement("sl-alert"),{variant:e,closable:!0,duration:5e3}),s=document.createElement("sl-icon");s.slot="icon",s.setAttribute("name",e==="danger"?"exclamation-triangle":"info-circle"),i.append(s,document.createTextNode(t)),document.body.appendChild(i),i.toast()}};qe.styles=ee`
    :host {
      display: flex;
      align-items: center;
      position: relative;
      z-index: 100;
      padding: 0.75rem 1rem;
      gap: 1rem;
      border-bottom: 1px solid var(--sl-color-neutral-200);
      background: var(--sl-color-neutral-50);
    }
    .title {
      font-weight: 600;
      font-size: 1.1rem;
      margin-right: auto;
    }
    .collection-controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .filters {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    sl-select {
      min-width: 120px;
    }
    .toolbar-icon-button {
      cursor: pointer;
      font-size: 1.25rem;
      color: var(--sl-color-neutral-600);
    }
    .toolbar-icon-button:hover {
      color: var(--sl-color-neutral-900);
    }
    .external-link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.8rem;
      color: var(--sl-color-primary-600);
      text-decoration: none;
      padding: 0.125rem 0.5rem;
      border-radius: var(--sl-border-radius-small);
      background: var(--sl-color-primary-50);
    }
    .external-link:hover {
      color: var(--sl-color-primary-700);
      background: var(--sl-color-primary-100);
    }
    .external-link sl-icon {
      font-size: 0.75rem;
    }
    .platform-badge {
      font-size: 0.75rem;
      padding: 0.125rem 0.5rem;
      border-radius: var(--sl-border-radius-small);
      background: var(--sl-color-neutral-100);
      color: var(--sl-color-neutral-700);
    }
    .refresh-controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .last-refreshed {
      font-size: 0.75rem;
      color: var(--sl-color-neutral-500);
      white-space: nowrap;
    }
    .read-only-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
      padding: 0.125rem 0.5rem;
      border-radius: var(--sl-border-radius-small);
      background: var(--sl-color-warning-100);
      color: var(--sl-color-warning-700);
      font-weight: 500;
    }
    .read-only-badge sl-icon {
      font-size: 0.75rem;
    }
    .view-switcher sl-radio-button::part(button) {
      padding: 0.25rem 0.5rem;
      font-size: 1.1rem;
      line-height: 1;
      min-width: 2rem;
      min-height: 2rem;
    }
    .view-switcher sl-radio-button::part(label) {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .user-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.8rem;
      color: var(--sl-color-neutral-700);
      padding: 0.125rem 0.5rem;
      border-radius: var(--sl-border-radius-small);
      background: var(--sl-color-neutral-100);
      white-space: nowrap;
    }
    .user-badge sl-icon {
      font-size: 0.9rem;
    }
  `;je([k()],qe.prototype,"currentView",2);je([k()],qe.prototype,"connectionStatus",2);je([k({attribute:!1})],qe.prototype,"client",2);je([k({attribute:!1})],qe.prototype,"unscopedClient",2);je([k()],qe.prototype,"collectionId",2);je([k({type:Boolean})],qe.prototype,"readOnly",2);je([k({type:Boolean})],qe.prototype,"externalWritable",2);je([k({attribute:!1})],qe.prototype,"phaseFilter",2);je([k({attribute:!1})],qe.prototype,"assigneeFilter",2);je([k({type:Boolean,reflect:!0})],qe.prototype,"isPolling",2);je([k({attribute:!1})],qe.prototype,"lastRefreshed",2);je([k({type:Boolean,reflect:!0})],qe.prototype,"isRefreshing",2);je([k({attribute:!1})],qe.prototype,"sessionUser",2);je([k({attribute:!1})],qe.prototype,"layoutOrientation",2);je([U()],qe.prototype,"isDark",2);je([U()],qe.prototype,"users",2);je([U()],qe.prototype,"usersLoading",2);je([U()],qe.prototype,"exporting",2);je([U()],qe.prototype,"currentCollection",2);je([le("ft-new-collection-dialog")],qe.prototype,"newCollectionDialog",2);je([le("ft-collection-settings-dialog")],qe.prototype,"collectionSettingsDialog",2);je([le("ft-import-collection-dialog")],qe.prototype,"importCollectionDialog",2);je([le("ft-collection-picker")],qe.prototype,"collectionPicker",2);qe=je([Oe("ft-toolbar")],qe);var $b=Object.defineProperty,Db=Object.getOwnPropertyDescriptor,wp=(e,t,i,s)=>{for(var r=s>1?void 0:s?Db(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&$b(t,i,r),r};const Nb=[{heading:"General",shortcuts:[{keys:["?"],description:"Toggle this keyboard shortcuts overlay"},{keys:["Cmd+K","Ctrl+K"],description:"Open the command palette to search tasks"}]},{heading:"Kanban board",shortcuts:[{keys:["Tab"],description:"Focus a task card"},{keys:["Enter","Space"],description:"Open the selected task in the inspector"},{keys:["Arrow Up","Arrow Down"],description:"Move between cards in the current column"},{keys:["Arrow Left","Arrow Right"],description:"Move to the nearest card in another column"},{keys:["Home","End"],description:"Jump to the first or last card in a column"}]},{heading:"Inspector",shortcuts:[{keys:["Tab"],description:"Move through editable fields and controls"},{keys:["Escape"],description:"Close an active editor, or close the inspector when no editor is active"}]}];let Lb=0,Nn=class extends ye{constructor(){super(...arguments),this.open=!1,this.previouslyFocusedElement=null,this.titleId=`shortcut-overlay-title-${++Lb}`,this.onDocumentKeyDown=e=>{this.open&&(e.key==="Escape"?(e.preventDefault(),e.stopPropagation(),this.requestClose()):e.key==="Tab"&&this.trapFocus(e))},this.onDocumentPointerDown=e=>{if(!this.open)return;const t=this.renderRoot.querySelector(".panel");t&&e.composedPath().includes(t)||this.requestClose()}}updated(e){e.has("open")&&(this.open?(this.previouslyFocusedElement=this.activeElement(),this.addDismissListeners(),this.updateComplete.then(()=>{var t;(t=this.renderRoot.querySelector(".close-button"))==null||t.focus()})):(this.removeDismissListeners(),this.restoreFocus()))}disconnectedCallback(){super.disconnectedCallback(),this.removeDismissListeners()}addDismissListeners(){document.addEventListener("keydown",this.onDocumentKeyDown,{capture:!0}),document.addEventListener("pointerdown",this.onDocumentPointerDown,{capture:!0})}removeDismissListeners(){document.removeEventListener("keydown",this.onDocumentKeyDown,{capture:!0}),document.removeEventListener("pointerdown",this.onDocumentPointerDown,{capture:!0})}requestClose(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}activeElement(){var t;let e=document.activeElement;for(;(t=e==null?void 0:e.shadowRoot)!=null&&t.activeElement;)e=e.shadowRoot.activeElement;return e instanceof HTMLElement?e:null}restoreFocus(){const e=this.previouslyFocusedElement;this.previouslyFocusedElement=null,e!=null&&e.isConnected&&e.focus()}trapFocus(e){var a;const t=this.focusableElements();if(t.length===0){e.preventDefault(),(a=this.renderRoot.querySelector(".panel"))==null||a.focus();return}const i=this.activeElement(),s=i?t.indexOf(i):-1,r=t.length-1,n=e.shiftKey&&s<=0,o=!e.shiftKey&&s===r;!n&&!o||(e.preventDefault(),t[n?r:0].focus())}focusableElements(){const e=this.renderRoot.querySelector(".panel");return e?Array.from(e.querySelectorAll(["a[href]","button:not([disabled])","input:not([disabled])","select:not([disabled])","textarea:not([disabled])","sl-button:not([disabled])","sl-icon-button:not([disabled])",'[tabindex]:not([tabindex="-1"])'].join(","))).filter(t=>t.offsetParent!==null):[]}renderShortcutGroup(e){return T`
      <section>
        <h3>${e.heading}</h3>
        <dl>
          ${e.shortcuts.map(t=>T`
              <dt>${t.keys.map(i=>T`<kbd>${i}</kbd>`)}</dt>
              <dd>${t.description}</dd>
            `)}
        </dl>
      </section>
    `}render(){return this.open?T`
      <div class="backdrop">
        <div
          class="panel"
          tabindex="-1"
          role="dialog"
          aria-modal="true"
          aria-labelledby=${this.titleId}
        >
          <div class="header">
            <h2 id=${this.titleId}>Keyboard Shortcuts</h2>
            <sl-icon-button
              class="close-button"
              name="x-lg"
              label="Close keyboard shortcuts"
              @click=${this.requestClose}
            ></sl-icon-button>
          </div>
          <div class="content">
            ${Nb.map(e=>this.renderShortcutGroup(e))}
          </div>
        </div>
      </div>
    `:Z}};Nn.styles=ee`
    :host {
      display: contents;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: clamp(1rem, 5vh, 3rem) 1rem 1rem;
      background: rgba(15, 23, 42, 0.42);
    }
    .panel {
      width: min(34rem, 100%);
      max-height: calc(100vh - 2rem);
      overflow: auto;
      border: 1px solid var(--sl-color-neutral-200);
      border-radius: var(--sl-border-radius-medium);
      background: var(--sl-color-neutral-0);
      box-shadow: var(--sl-shadow-large);
      color: var(--sl-color-neutral-900);
    }
    .panel:focus {
      outline: none;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1rem 0.75rem;
      border-bottom: 1px solid var(--sl-color-neutral-200);
    }
    h2 {
      flex: 1;
      margin: 0;
      font-size: 1rem;
      line-height: 1.3;
      font-weight: 700;
    }
    .close-button {
      color: var(--sl-color-neutral-500);
    }
    .close-button:hover {
      color: var(--sl-color-neutral-900);
    }
    .content {
      padding: 0.875rem 1rem 1rem;
    }
    section + section {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--sl-color-neutral-100);
    }
    h3 {
      margin: 0 0 0.625rem;
      color: var(--sl-color-neutral-600);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    dl {
      display: grid;
      grid-template-columns: minmax(8rem, max-content) 1fr;
      gap: 0.5rem 1rem;
      margin: 0;
      align-items: center;
    }
    dt {
      display: flex;
      gap: 0.25rem;
      flex-wrap: wrap;
    }
    dd {
      margin: 0;
      color: var(--sl-color-neutral-700);
      font-size: 0.875rem;
      line-height: 1.4;
    }
    kbd {
      min-width: 1.75rem;
      padding: 0.125rem 0.4rem;
      border: 1px solid var(--sl-color-neutral-300);
      border-bottom-width: 2px;
      border-radius: var(--sl-border-radius-small);
      background: var(--sl-color-neutral-50);
      color: var(--sl-color-neutral-800);
      font-family: var(--sl-font-mono);
      font-size: 0.75rem;
      line-height: 1.35;
      text-align: center;
      white-space: nowrap;
    }

    @media (max-width: 520px) {
      .backdrop {
        align-items: stretch;
        padding: 0;
      }
      .panel {
        width: 100%;
        max-height: 100vh;
        border-width: 0;
        border-radius: 0;
      }
      dl {
        grid-template-columns: 1fr;
        gap: 0.25rem;
      }
      dd + dt {
        margin-top: 0.375rem;
      }
    }
  `;wp([k({type:Boolean,reflect:!0})],Nn.prototype,"open",2);Nn=wp([Oe("ft-shortcut-overlay")],Nn);var Pb=Object.defineProperty,Mb=Object.getOwnPropertyDescriptor,As=(e,t,i,s)=>{for(var r=s>1?void 0:s?Mb(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&Pb(t,i,r),r};let Bi=class extends ye{constructor(){super(...arguments),this.errorMessage="",this.collections=[],this.isLoading=!0,this.loadError="",this.loadToken=0}updated(e){e.has("client")&&this.client!==e.get("client")&&this.loadCollections()}render(){return T`
      <main class="shell">
        <div class="header">
          <div class="header-text">
            <h1>Select a collection</h1>
            <p class="lede">Choose which collection to open.</p>
          </div>
          <sl-button variant="primary" @click=${this.onNewProjectClick}>
            <sl-icon slot="prefix" name="plus-lg"></sl-icon>
            New Project
          </sl-button>
        </div>

        <!-- Shoelace renders sl-alert with role="alert" internally. -->
        ${this.errorMessage?T`<sl-alert variant="warning" open>${this.errorMessage}</sl-alert>`:null}
        ${this.loadError?T`<sl-alert variant="danger" open>${this.loadError}</sl-alert>`:null}

        ${this.isLoading?T`<div class="loading"><sl-spinner></sl-spinner> Loading collections</div>`:this.collections.length===0?T`<div class="empty">No collections are available.</div>`:T`
                <div class="list">
                  ${this.collections.map(e=>{const t=e.platform!==ke.FARMTABLE;return T`
                      <button
                        class="collection"
                        type="button"
                        @click=${()=>this.selectCollection(e)}
                      >
                        <span class="name">${e.name}</span>
                        <span class="meta">
                          <sl-icon name=${Pl(e.platform)} aria-hidden="true"></sl-icon>
                          ${t&&e.remoteId?T`${Es(e.platform)}: ${e.remoteId}`:Es(e.platform)}
                        </span>
                      </button>
                    `})}
                </div>
              `}

        <ft-new-collection-dialog
          @collection-create=${this.onCollectionCreate}
        ></ft-new-collection-dialog>
      </main>
    `}async loadCollections(){if(!this.client)return;const e=++this.loadToken;this.isLoading=!0,this.loadError="";try{const t=await this.client.listCollections();e===this.loadToken&&(this.collections=t)}catch(t){e===this.loadToken&&(this.collections=[],this.loadError="Unable to load collections."),console.warn("Failed to load collections",t)}finally{e===this.loadToken&&(this.isLoading=!1)}}async onNewProjectClick(){await this.newCollectionDialog.show()}async onCollectionCreate(e){const t=this.newCollectionDialog;if(!this.client){t.setError("Service not available. Please reload.");return}t.setError(""),t.setCreating(!0);try{const i=await this.client.createCollection(e.detail.name);t.close(),this.dispatchEvent(new CustomEvent("collection-select",{detail:{collectionId:i.id},bubbles:!0,composed:!0}))}catch(i){t.setError("Failed to create collection. Please try again."),console.warn("Failed to create collection",i)}finally{t.setCreating(!1)}}selectCollection(e){this.dispatchEvent(new CustomEvent("collection-select",{detail:{collectionId:e.id},bubbles:!0,composed:!0}))}};Bi.styles=ee`
    :host {
      display: block;
      background: var(--sl-color-neutral-0);
      color: var(--sl-color-neutral-900);
      font-family: var(--sl-font-sans);
    }

    .shell {
      max-width: 760px;
      margin: 0 auto;
      padding: 3rem 1rem;
    }

    h1 {
      margin: 0 0 0.5rem;
      font-size: 1.75rem;
      line-height: 1.2;
      font-weight: var(--sl-font-weight-semibold);
    }

    .lede {
      margin: 0;
      color: var(--sl-color-neutral-600);
    }

    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .header-text {
      flex: 1;
    }

    sl-alert {
      margin-bottom: 1rem;
    }

    .list {
      display: grid;
      gap: 0.75rem;
    }

    button.collection {
      width: 100%;
      border: 1px solid var(--sl-color-neutral-200);
      border-radius: 6px;
      background: var(--sl-color-neutral-0);
      color: inherit;
      padding: 1rem;
      text-align: left;
      cursor: pointer;
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }

    button.collection:hover {
      border-color: var(--sl-color-primary-400);
      box-shadow: var(--sl-shadow-x-small);
    }

    button.collection:focus-visible {
      outline: 2px solid var(--sl-color-primary-500);
      outline-offset: 2px;
    }

    .name {
      display: block;
      font-size: 1rem;
      font-weight: var(--sl-font-weight-semibold);
      overflow-wrap: anywhere;
    }

    .meta {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      margin-top: 0.25rem;
      color: var(--sl-color-neutral-600);
      font-size: 0.875rem;
    }

    .meta sl-icon {
      font-size: 0.8rem;
    }

    .empty,
    .loading {
      color: var(--sl-color-neutral-600);
      padding: 1rem 0;
    }
  `;As([le("ft-new-collection-dialog")],Bi.prototype,"newCollectionDialog",2);As([k({attribute:!1})],Bi.prototype,"client",2);As([k({attribute:"error-message"})],Bi.prototype,"errorMessage",2);As([U()],Bi.prototype,"collections",2);As([U()],Bi.prototype,"isLoading",2);As([U()],Bi.prototype,"loadError",2);Bi=As([Oe("ft-collection-list")],Bi);var Fb=Object.defineProperty,zb=Object.getOwnPropertyDescriptor,ls=(e,t,i,s)=>{for(var r=s>1?void 0:s?zb(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&Fb(t,i,r),r};const Bb={[Q.UNSPECIFIED]:"neutral",[Q.URGENT]:"danger",[Q.HIGH]:"warning",[Q.NORMAL]:"primary",[Q.LOW]:"neutral"},gd={[Q.UNSPECIFIED]:"No priority",[Q.URGENT]:"Urgent",[Q.HIGH]:"High",[Q.NORMAL]:"Normal",[Q.LOW]:"Low"},Ub=[Q.UNSPECIFIED,Q.URGENT,Q.HIGH,Q.NORMAL,Q.LOW],bd=3,vd=80;let Ei=class extends ye{constructor(){super(...arguments),this.selected=!1,this.readOnly=!1,this.cardTabIndex=0,this.isEditingTitle=!1,this.isEditingPriority=!1,this.titleDraft=""}get isBlocked(){return this.task.relationships.some(e=>e.type===fe.BLOCKED_BY)}onDragStart(e){if(this.readOnly||this.isEditingTitle||this.isEditingPriority){e.preventDefault();return}e.dataTransfer.setData("text/plain",this.task.id),e.dataTransfer.effectAllowed="move",this.setAttribute("dragging","")}onDragEnd(){this.removeAttribute("dragging")}onClick(){this.dispatchTaskSelect()}onKeyDown(e){e.target===e.currentTarget&&(e.key!=="Enter"&&e.key!==" "||(e.preventDefault(),this.dispatchTaskSelect()))}dispatchTaskSelect(){this.dispatchEvent(new CustomEvent("task-select",{detail:{taskId:this.task.id},bubbles:!0,composed:!0}))}focusCard(){var e;(e=this.renderRoot.querySelector(".card-shell"))==null||e.focus()}stopCardInteraction(e){e.stopPropagation()}async startTitleEdit(e){if(this.readOnly)return;e==null||e.stopPropagation(),this.titleDraft=this.task.name,this.isEditingTitle=!0,await this.updateComplete;const t=this.renderRoot.querySelector("sl-input.title-input");t==null||t.focus(),t==null||t.select()}saveTitleEdit(){if(!this.isEditingTitle)return;const e=this.titleDraft.trim();this.isEditingTitle=!1,!(!e||e===this.task.name)&&this.dispatchTaskUpdate({name:e})}cancelTitleEdit(e){e==null||e.stopPropagation(),this.titleDraft=this.task.name,this.isEditingTitle=!1}onTitleInput(e){this.titleDraft=e.currentTarget.value}onTitleKeyDown(e){e.stopPropagation(),e.key==="Enter"?(e.preventDefault(),this.saveTitleEdit()):e.key==="Escape"&&(e.preventDefault(),this.cancelTitleEdit())}async startPriorityEdit(e){var i;if(this.readOnly)return;e.stopPropagation(),this.isEditingPriority=!0,await this.updateComplete;const t=this.renderRoot.querySelector("sl-select.priority-select");t==null||t.focus(),(i=t==null?void 0:t.show)==null||i.call(t)}onPriorityChange(e){e.stopPropagation();const t=Number(e.currentTarget.value);if(Number.isNaN(t))return;const i=t;this.isEditingPriority=!1,i!==(this.task.priority??Q.UNSPECIFIED)&&this.dispatchTaskUpdate({priority:i})}onPriorityBlur(){this.isEditingPriority=!1}dispatchTaskUpdate(e){this.dispatchEvent(new CustomEvent("task-update",{detail:{taskId:this.task.id,fields:e},bubbles:!0,composed:!0}))}renderPriorityEditor(e){return T`
      <sl-select
        class="priority-select"
        size="small"
        value=${String(e)}
        hoist
        @mousedown=${this.stopCardInteraction}
        @click=${this.stopCardInteraction}
        @sl-change=${this.onPriorityChange}
        @sl-after-hide=${this.onPriorityBlur}
      >
        ${Ub.map(t=>T`
            <sl-option value=${String(t)}>${gd[t]}</sl-option>
          `)}
      </sl-select>
    `}renderPriorityBadge(e,t,i){return this.readOnly?T`<sl-badge variant=${i} pill>${t}</sl-badge>`:T`
      <button
        class="priority-button"
        type="button"
        title="Edit priority"
        @mousedown=${this.stopCardInteraction}
        @click=${this.startPriorityEdit}
      >
        <sl-badge variant=${i} pill>${t}</sl-badge>
      </button>
    `}render(){const e=this.task,t=e.name.length>vd?e.name.slice(0,vd)+"…":e.name,i=e.priority??Q.UNSPECIFIED,s=Bb[i]??"neutral",r=gd[i]??"Unknown",n=e.labels.slice(0,bd),o=e.labels.length-bd,a=e.assignees[0];return T`
      <div
        class=${Ce({"card-shell":!0,selected:this.selected})}
        tabindex=${this.cardTabIndex}
        role="option"
        aria-label=${`Task: ${this.task.name}`}
        aria-selected=${String(this.selected)}
        draggable=${String(!this.readOnly&&!this.isEditingTitle&&!this.isEditingPriority)}
        @dragstart=${this.onDragStart}
        @dragend=${this.onDragEnd}
        @click=${this.onClick}
        @keydown=${this.onKeyDown}
      >
        <sl-card>
          <div class="title" @dblclick=${this.startTitleEdit}>
            ${this.isEditingTitle?T`
                  <sl-input
                    class="title-input"
                    size="small"
                    maxlength="200"
                    value=${this.titleDraft}
                    @mousedown=${this.stopCardInteraction}
                    @click=${this.stopCardInteraction}
                    @input=${this.onTitleInput}
                    @keydown=${this.onTitleKeyDown}
                    @blur=${this.saveTitleEdit}
                  ></sl-input>
                `:T`
                  <span class="title-text">${t}</span>
                  ${this.readOnly?Z:T`<sl-icon-button
                    class="title-edit-button"
                    name="pencil"
                    size="small"
                    label="Edit title"
                    @mousedown=${this.stopCardInteraction}
                    @click=${this.startTitleEdit}
                  ></sl-icon-button>`}
                `}
          </div>
          <div class="meta">
            ${this.isEditingPriority?this.renderPriorityEditor(i):this.renderPriorityBadge(i,r,s)}
            ${e.type?T`<span class="type">${e.type}</span>`:Z}
            ${this.isBlocked?T`<sl-icon name="lock" class="blocked-icon"></sl-icon>`:Z}
            ${a?T`<sl-avatar
                  class="assignee"
                  initials=${a.name.slice(0,2)}
                  label=${a.name}
                  style="--size: 1.5rem; font-size: 0.6rem;"
                ></sl-avatar>`:Z}
          </div>
          ${n.length>0?T`
                <div class="labels">
                  ${n.map(c=>T`<sl-tag size="small" variant="neutral">${c}</sl-tag>`)}
                  ${o>0?T`<span class="overflow-label">+${o} more</span>`:Z}
                </div>
              `:Z}
        </sl-card>
      </div>
    `}};Ei.styles=ee`
    :host {
      display: block;
    }
    sl-card {
      width: 100%;
      cursor: grab;
      transition: box-shadow 0.15s, border-color 0.15s;
      --border-color: var(--sl-color-neutral-200);
    }
    sl-card:active {
      cursor: grabbing;
    }
    sl-card::part(base) {
      background: var(--sl-color-neutral-50);
    }
    :host([dragging]) sl-card {
      opacity: 0.5;
    }
    .card-shell {
      --ft-focus-ring: 2px solid var(--sl-color-primary-500);
      --ft-focus-ring-offset: 2px;
    }
    .card-shell:focus {
      outline: none;
    }
    .card-shell:focus-visible sl-card {
      outline: var(--ft-focus-ring);
      outline-offset: var(--ft-focus-ring-offset);
      border-radius: var(--sl-border-radius-medium);
    }
    .selected sl-card,
    .selected sl-card::part(base) {
      border-color: var(--sl-color-primary-500);
      box-shadow: 0 0 0 1px var(--sl-color-primary-500);
    }
    .title {
      display: flex;
      align-items: flex-start;
      gap: 0.25rem;
      font-size: 0.875rem;
      font-weight: 600;
      line-height: 1.4;
      margin-bottom: 0.5rem;
      word-break: break-word;
    }
    .title-text {
      flex: 1;
      min-width: 0;
    }
    .title-edit-button {
      flex-shrink: 0;
      margin-top: -0.25rem;
      opacity: 0;
      transition: opacity 0.15s, color 0.15s;
      color: var(--sl-color-neutral-500);
    }
    .title:hover .title-edit-button,
    .title-edit-button:focus-visible {
      opacity: 1;
    }
    sl-input.title-input {
      width: 100%;
      --sl-input-height-small: 1.75rem;
      --sl-input-font-size-small: 0.875rem;
    }
    .priority-button {
      border: 0;
      background: transparent;
      padding: 0;
      cursor: pointer;
      line-height: 1;
    }
    .priority-button:focus-visible {
      outline: 2px solid var(--sl-color-primary-500);
      outline-offset: 2px;
      border-radius: 999px;
    }
    sl-select.priority-select {
      width: 7rem;
      --sl-input-height-small: 1.5rem;
      --sl-input-font-size-small: 0.75rem;
    }
    .meta {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      flex-wrap: wrap;
      font-size: 0.8rem;
    }
    .type {
      color: var(--sl-color-neutral-500);
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .assignee {
      margin-left: auto;
    }
    .labels {
      display: flex;
      gap: 0.25rem;
      flex-wrap: wrap;
      margin-top: 0.375rem;
    }
    sl-tag::part(base) {
      font-size: 0.75rem;
      padding: 0 0.35rem;
      height: 1.25rem;
    }
    .overflow-label {
      font-size: 0.75rem;
      color: var(--sl-color-neutral-500);
      line-height: 1.25rem;
    }
    .blocked-icon {
      color: var(--ft-stage-blocked);
    }
  `;ls([k({attribute:!1})],Ei.prototype,"task",2);ls([k({type:Boolean})],Ei.prototype,"selected",2);ls([k({type:Boolean})],Ei.prototype,"readOnly",2);ls([k({type:Number,attribute:"card-tab-index"})],Ei.prototype,"cardTabIndex",2);ls([U()],Ei.prototype,"isEditingTitle",2);ls([U()],Ei.prototype,"isEditingPriority",2);ls([U()],Ei.prototype,"titleDraft",2);Ei=ls([Oe("ft-task-card")],Ei);var qb=Object.defineProperty,Hb=Object.getOwnPropertyDescriptor,ci=(e,t,i,s)=>{for(var r=s>1?void 0:s?Hb(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&qb(t,i,r),r};const Vb={[W.TRIAGE]:"var(--ft-stage-triage)",[W.ACCEPTED]:"var(--ft-stage-accepted)",[W.WORKING]:"var(--ft-stage-working)",[W.IN_REVIEW]:"var(--ft-stage-in-review)",[W.IN_QA]:"var(--ft-stage-in-qa)",[W.DEPLOYING]:"var(--ft-stage-deploying)",[W.COMPLETED]:"var(--ft-stage-completed)"};function yd(e){return e===void 0||e===Q.UNSPECIFIED?99:e}function jb(e){return[...e].sort((t,i)=>{const s=yd(t.priority),r=yd(i.priority);return s!==r?s-r:t.createdAt.localeCompare(i.createdAt)})}let Ut=class extends ye{constructor(){super(...arguments),this.stage=W.UNSPECIFIED,this.tasks=[],this.label="",this.totalCount=0,this.selectedTaskId=null,this.readOnly=!1,this.isDragOver=!1,this.activeCardIndex=0,this._sortedTasks=[],this._dragEnterCount=0}updated(e){if(e.has("tasks")){this._sortedTasks=jb(this.tasks);const t=this._sortedTasks.length-1;this.activeCardIndex=Math.max(0,Math.min(this.activeCardIndex,t))}e.has("selectedTaskId")&&this.selectedTaskId&&this.scrollToSelectedCard()}async scrollToSelectedCard(){if(!this._sortedTasks.some(i=>i.id===this.selectedTaskId))return;await this.updateComplete;const t=this.cardElements.find(i=>i.selected);t&&t.scrollIntoView({behavior:"smooth",block:"nearest",inline:"nearest"})}get isStageChangeDragDisabled(){var e;return this.readOnly||((e=this.capabilities)==null?void 0:e.canChangeStage)===!1}onDragEnter(){this.isStageChangeDragDisabled||(this._dragEnterCount++,this.isDragOver=!0)}onDragOver(e){this.isStageChangeDragDisabled||(e.preventDefault(),e.dataTransfer.dropEffect="move")}onDragLeave(){this.isStageChangeDragDisabled||(this._dragEnterCount--,this.isDragOver=this._dragEnterCount>0)}onDrop(e){if(this.isStageChangeDragDisabled)return;e.preventDefault(),this._dragEnterCount=0,this.isDragOver=!1;const t=e.dataTransfer.getData("text/plain");t&&this.dispatchEvent(new CustomEvent("stage-change",{detail:{taskId:t,stage:this.stage},bubbles:!0,composed:!0}))}onAddTaskClick(e){var t;this.readOnly||((t=this.capabilities)==null?void 0:t.canCreateTask)===!1||(e.stopPropagation(),this.dispatchEvent(new CustomEvent("column-add-task",{detail:{stage:this.stage,label:this.label},bubbles:!0,composed:!0})))}async focusCardAt(e){var s;const t=this.cardElements;if(t.length===0)return;const i=Math.max(0,Math.min(e,t.length-1));this.activeCardIndex=i,await this.updateComplete,(s=this.cardElements[i])==null||s.focusCard()}async focusTaskAt(e){await this.focusCardAt(e)}get cardElements(){return Array.from(this.renderRoot.querySelectorAll("ft-task-card"))}cardIndexFromEvent(e){const t=Number(e.currentTarget.dataset.cardIndex);return Number.isNaN(t)?null:t}onCardFocusHandler(e){const t=this.cardIndexFromEvent(e);t!==null&&(this.activeCardIndex=t)}onCardKeyDownHandler(e){if(e.defaultPrevented)return;const t=this.cardIndexFromEvent(e);if(t!==null)switch(e.key){case"ArrowDown":e.preventDefault(),this.focusCardAt(t+1);break;case"ArrowUp":e.preventDefault(),this.focusCardAt(t-1);break;case"Home":e.preventDefault(),this.focusCardAt(0);break;case"End":e.preventDefault(),this.focusCardAt(this.cardElements.length-1);break;case"ArrowLeft":case"ArrowRight":e.preventDefault(),this.activeCardIndex=t,this.dispatchEvent(new CustomEvent("column-nav",{detail:{direction:e.key==="ArrowLeft"?"left":"right",fromIndex:t,stage:this.stage},bubbles:!0,composed:!0}));break}}render(){var o;const e=this._sortedTasks,t=Vb[this.stage]??"var(--ft-stage-triage)",i=this.totalCount>0&&e.length!==this.totalCount,s=i?`${e.length} of ${this.totalCount}`:`${e.length}`,r=T`
      <span class=${Ce({count:!0,filtered:i})} aria-label=${`${s} tasks`}
        >${s}</span
      >
    `,n=i?`${e.length} tasks visible out of ${this.totalCount} total (filter active)`:"";return T`
      <div class="header">
        <span class="color-dot" style="background: ${t}"></span>
        ${this.label}
        ${i?T`<sl-tooltip class="count-tooltip" content=${n} hoist placement="bottom"
              >${r}</sl-tooltip
            >`:r}
        ${this.readOnly||((o=this.capabilities)==null?void 0:o.canCreateTask)===!1?Z:T`<sl-icon-button
          class="add-task-button"
          name="plus"
          size="small"
          label=${`Add task to ${this.label}`}
          @click=${this.onAddTaskClick}
        ></sl-icon-button>`}
      </div>
      <div
        class=${Ce({cards:!0,dragover:this.isDragOver})}
        role="listbox"
        aria-label=${this.label}
        @dragenter=${this.onDragEnter}
        @dragover=${this.onDragOver}
        @dragleave=${this.onDragLeave}
        @drop=${this.onDrop}
      >
        ${e.map((a,c)=>T`
            <ft-task-card
              .task=${a}
              ?selected=${a.id===this.selectedTaskId}
              ?readOnly=${this.readOnly}
              card-tab-index=${c===this.activeCardIndex?0:-1}
              data-card-index=${c}
              @focusin=${this.onCardFocusHandler}
              @keydown=${this.onCardKeyDownHandler}
            ></ft-task-card>
          `)}
        ${i&&e.length===0?T`<div class="empty-filter-message" role="status">
              <!-- NOTE(i18n): Hardcoded English; extract if i18n is added. -->
              No visible tasks match this filter.
            </div>`:Z}
      </div>
    `}};Ut.styles=ee`
    :host {
      display: flex;
      flex-direction: column;
      min-width: 260px;
      max-width: 300px;
      background: var(--sl-color-neutral-100);
      border-radius: 0.5rem;
      overflow: hidden;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 0.75rem 0.5rem;
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--sl-color-neutral-700);
    }
    .color-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .count {
      margin-left: auto;
      background: var(--sl-color-neutral-200);
      color: var(--sl-color-neutral-600);
      border-radius: 999px;
      padding: 0.1rem 0.45rem;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0;
      text-transform: none;
    }
    .count.filtered {
      background: var(--sl-color-primary-100);
      color: var(--sl-color-primary-700);
    }
    .count-tooltip {
      margin-left: auto;
    }
    .count-tooltip .count {
      margin-left: 0;
    }
    .add-task-button {
      --sl-input-height-small: 1.5rem;
      color: var(--sl-color-neutral-600);
      opacity: 0.35;
      transition: opacity 0.15s, color 0.15s;
    }
    .header:hover .add-task-button,
    .add-task-button:focus-visible {
      opacity: 0.85;
    }
    .add-task-button:hover {
      color: var(--sl-color-primary-600);
      opacity: 1;
    }
    .cards {
      flex: 1;
      padding: 0 0.5rem 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-height: 2rem;
      transition: background 0.15s;
    }
    .cards.dragover {
      background: rgba(59, 130, 246, 0.08);
      outline: 2px dashed var(--sl-color-primary-400);
      outline-offset: -2px;
      border-radius: 0.25rem;
    }
    .empty-filter-message {
      color: var(--sl-color-neutral-500);
      font-size: 0.8rem;
      line-height: 1.4;
      padding: 0.75rem 0.25rem;
      text-align: center;
    }
  `;ci([k({type:Number})],Ut.prototype,"stage",2);ci([k({attribute:!1})],Ut.prototype,"tasks",2);ci([k()],Ut.prototype,"label",2);ci([k({type:Number,attribute:"total-count"})],Ut.prototype,"totalCount",2);ci([k({attribute:"selected-task-id"})],Ut.prototype,"selectedTaskId",2);ci([k({type:Boolean})],Ut.prototype,"readOnly",2);ci([k({attribute:!1})],Ut.prototype,"capabilities",2);ci([U()],Ut.prototype,"isDragOver",2);ci([U()],Ut.prototype,"activeCardIndex",2);ci([U()],Ut.prototype,"_sortedTasks",2);Ut=ci([Oe("ft-kanban-column")],Ut);var Gb=Object.defineProperty,Wb=Object.getOwnPropertyDescriptor,cs=(e,t,i,s)=>{for(var r=s>1?void 0:s?Wb(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&Gb(t,i,r),r};let xi=class extends ye{constructor(){super(...arguments),this.isCreating=!1,this.errorMessage="",this.targetStage=null,this.targetStageLabel=""}async show(){await this.updateComplete,await this.dialog.show(),this.nameInput.focus()}close(){this.dialog.hide()}setCreating(e){this.isCreating=e}setError(e){this.errorMessage=e}setTarget(e,t){this.targetStage=e,this.targetStageLabel=t}onCancel(){this.isCreating||this.close()}onCreateClick(){var e;(e=this.renderRoot.querySelector("form"))==null||e.requestSubmit()}onSubmit(e){e.preventDefault();const t=this.nameInput.value.trim(),i=this.descriptionInput.value.trim();this.nameInput.value=t,this.nameInput.reportValidity()&&(this.errorMessage="",this.dispatchEvent(new CustomEvent("task-create",{detail:{name:t,description:i||void 0,stage:this.targetStage??void 0},bubbles:!0,composed:!0})))}onAfterHide(){this.isCreating=!1,this.errorMessage="",this.targetStage=null,this.targetStageLabel="",this.nameInput.value="",this.descriptionInput.value=""}onRequestClose(e){this.isCreating&&e.preventDefault()}render(){return T`
      <sl-dialog
        label=${this.targetStage!=null?`Add Task to ${this.targetStageLabel}`:"Add Task"}
        @sl-after-hide=${this.onAfterHide}
        @sl-request-close=${this.onRequestClose}
      >
        <form id="add-task-form" @submit=${this.onSubmit}>
          ${this.errorMessage?T`
                <sl-alert variant="danger" open>
                  <sl-icon slot="icon" name="exclamation-triangle"></sl-icon>
                  ${this.errorMessage}
                </sl-alert>
              `:null}
          <sl-input
            name="name"
            label="Name"
            required
            maxlength="255"
            autocomplete="off"
            ?disabled=${this.isCreating}
          ></sl-input>
          <sl-textarea
            name="description"
            label="Description"
            maxlength="10000"
            resize="vertical"
            ?disabled=${this.isCreating}
          ></sl-textarea>
        </form>
        <div class="actions" slot="footer">
          <sl-button ?disabled=${this.isCreating} @click=${this.onCancel}>
            Cancel
          </sl-button>
          <sl-button
            variant="primary"
            ?loading=${this.isCreating}
            ?disabled=${this.isCreating}
            @click=${this.onCreateClick}
          >
            Create
          </sl-button>
        </div>
      </sl-dialog>
    `}};xi.styles=ee`
    form {
      display: grid;
      gap: 1rem;
    }
    sl-textarea::part(textarea) {
      min-height: 7rem;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `;cs([le("sl-dialog")],xi.prototype,"dialog",2);cs([le('sl-input[name="name"]')],xi.prototype,"nameInput",2);cs([le('sl-textarea[name="description"]')],xi.prototype,"descriptionInput",2);cs([U()],xi.prototype,"isCreating",2);cs([U()],xi.prototype,"errorMessage",2);cs([k({type:Number})],xi.prototype,"targetStage",2);cs([k()],xi.prototype,"targetStageLabel",2);xi=cs([Oe("ft-add-task-dialog")],xi);class Is{constructor(t,i){this.onChanged=()=>this.host.requestUpdate(),this.onSnapshot=()=>this.host.requestUpdate(),this.host=t,this.store=i,t.addController(this)}hostConnected(){this.store.addEventListener("tasks-changed",this.onChanged),this.store.addEventListener("snapshot-complete",this.onSnapshot)}hostDisconnected(){this.store.removeEventListener("tasks-changed",this.onChanged),this.store.removeEventListener("snapshot-complete",this.onSnapshot)}get taskStore(){return this.store}}function _p(e,t){const{parentTaskId:i,dueDate:s,startDate:r,addLabels:n,removeLabels:o,assigneeIds:a,clearAssignees:c,addBlocks:d,addBlockedBy:l,removeRelationships:u,...p}=t,h={...e,...p};if(i===null?delete h.parentTaskId:i!==void 0&&(h.parentTaskId=i),s===null?delete h.dueDate:s!==void 0&&(h.dueDate=s),r===null?delete h.startDate:r!==void 0&&(h.startDate=r),n!==void 0){const g=new Set(h.labels);for(const f of n)g.add(f);h.labels=[...g]}if(o!==void 0){const g=new Set(o);h.labels=(h.labels??[]).filter(f=>!g.has(f))}if(c)h.assignees=[];else if(a!==void 0){const g=new Map(e.assignees.map(f=>[f.id,f]));h.assignees=a.map(f=>g.get(f)??{id:f,name:f,type:Pt.HUMAN,status:Mt.ACTIVE})}if(d!==void 0){const g=new Set(h.relationships.filter(m=>m.type===fe.BLOCKS).map(m=>m.targetTaskId)),f=d.filter(m=>!g.has(m)).map(m=>({type:fe.BLOCKS,targetTaskId:m}));f.length&&(h.relationships=[...h.relationships,...f])}if(l!==void 0){const g=new Set(h.relationships.filter(m=>m.type===fe.BLOCKED_BY).map(m=>m.targetTaskId)),f=l.filter(m=>!g.has(m)).map(m=>({type:fe.BLOCKED_BY,targetTaskId:m}));f.length&&(h.relationships=[...h.relationships,...f])}if(u!==void 0){const g=new Set(u);h.relationships=h.relationships.filter(f=>!g.has(f.targetTaskId))}return h}const ei="00000000-0000-0000-0000-000000000001",Gt=new Date().toISOString();ke.FARMTABLE;function wd(e){switch(e){case W.TRIAGE:case W.ACCEPTED:return ne.OPEN;case W.WORKING:case W.IN_REVIEW:case W.IN_QA:case W.DEPLOYING:return ne.IN_PROGRESS;case W.COMPLETED:case W.WONT_FIX:case W.DUPLICATE:case W.CANCELLED:return ne.CLOSED;default:return ne.UNSPECIFIED}}ne.OPEN,W.ACCEPTED,Q.HIGH,Pt.HUMAN,Mt.ACTIVE,ke.FARMTABLE,ne.IN_PROGRESS,W.WORKING,Q.URGENT,Pt.HUMAN,Mt.ACTIVE,ke.FARMTABLE,ne.OPEN,W.ACCEPTED,Q.NORMAL,ke.FARMTABLE,ne.OPEN,W.TRIAGE,Q.NORMAL,ke.FARMTABLE,ne.IN_PROGRESS,W.IN_REVIEW,Q.HIGH,Pt.HUMAN,Mt.ACTIVE,Pt.AGENT,Mt.ACTIVE,ke.FARMTABLE,ne.ON_HOLD,W.ACCEPTED,Q.URGENT,Pt.HUMAN,Mt.ACTIVE,ke.FARMTABLE,ne.IN_PROGRESS,W.IN_QA,Q.LOW,Pt.AGENT,Mt.ACTIVE,ke.FARMTABLE,ne.CLOSED,W.COMPLETED,Q.NORMAL,Pt.HUMAN,Mt.ACTIVE,ke.FARMTABLE,ne.IN_PROGRESS,W.DEPLOYING,Q.NORMAL,Pt.HUMAN,Mt.ACTIVE,ke.FARMTABLE,ne.IN_PROGRESS,W.WORKING,Q.HIGH,ke.FARMTABLE;Pt.HUMAN,Mt.ACTIVE,Pt.HUMAN,Mt.ACTIVE,Pt.AGENT,Mt.ACTIVE;var Yb=Object.defineProperty,Kb=Object.getOwnPropertyDescriptor,Vi=(e,t,i,s)=>{for(var r=s>1?void 0:s?Kb(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&Yb(t,i,r),r};const Do=[{stage:W.TRIAGE,label:"Triage",phase:ne.OPEN},{stage:W.ACCEPTED,label:"Accepted",phase:ne.OPEN},{stage:W.WORKING,label:"Working",phase:ne.IN_PROGRESS},{stage:W.IN_REVIEW,label:"In Review",phase:ne.IN_PROGRESS},{stage:W.IN_QA,label:"In QA",phase:ne.IN_PROGRESS},{stage:W.DEPLOYING,label:"Deploying",phase:ne.IN_PROGRESS},{stage:W.COMPLETED,label:"Completed",phase:ne.CLOSED}],_d=[],Xb=new Set([W.COMPLETED,W.WONT_FIX,W.DUPLICATE,W.CANCELLED]);let dt=class extends ye{constructor(){super(...arguments),this.selectedTaskId=null,this.phaseFilter=null,this.assigneeFilter=null,this.readOnly=!1,this.onHoldExpanded=!1,this._autoScrollRafId=null,this._autoScrollContainer=null,this._autoScrollDirection=0,this._autoScrollSpeed=0,this.autoScrollLoop=()=>{if(!this._autoScrollContainer||this._autoScrollDirection===0){this._autoScrollRafId=null;return}this._autoScrollContainer.scrollLeft+=this._autoScrollDirection*this._autoScrollSpeed,this._autoScrollRafId=requestAnimationFrame(this.autoScrollLoop)}}connectedCallback(){super.connectedCallback(),this.storeController=new Is(this,this.store)}disconnectedCallback(){super.disconnectedCallback(),this.stopAutoScroll()}getColumnTasks(e){return this.store.getByStage(e).filter(t=>this.matchesFilters(t))}matchesFilters(e){return Dn(e,this.phaseFilter,this.assigneeFilter)}async onStageChange(e){var a;if(this.readOnly||((a=this.capabilities)==null?void 0:a.canChangeStage)===!1)return;const{taskId:t,stage:i}=e.detail,s=this.store.getTask(t);if(!s||s.stage===i||Xb.has(i)&&i!==W.COMPLETED)return;const r=s.stage,n=s.phase,o=wd(i);this.store.upsert({...s,stage:i,phase:o});try{this.client?await this.client.updateTask(t,{stage:i,phase:o}):console.warn("No client configured — stage change is local only")}catch(c){console.warn("Failed to update task stage; rolled back optimistic change",c),this.store.upsert({...s,stage:r,phase:n}),this.dispatchEvent(new CustomEvent("write-error",{bubbles:!0,composed:!0,detail:{error:c}}))}}async onTaskUpdate(e){if(this.readOnly)return;const{taskId:t,fields:i}=e.detail,s=this.store.getTask(t);if(!s)return;const r=_p(s,i);this.store.upsert(r);try{this.client?await this.client.updateTask(t,i):console.warn("No client configured — task update is local only")}catch(n){console.warn("Failed to update task; rolled back optimistic change",n),this.store.upsert(s),this.dispatchEvent(new CustomEvent("write-error",{bubbles:!0,composed:!0,detail:{error:n}}))}}toggleOnHold(){this.onHoldExpanded=!this.onHoldExpanded}onContainerDragOver(e){const t=e.currentTarget;this.updateAutoScroll(t,e.clientX)}onContainerDragLeave(e){e.currentTarget.contains(e.relatedTarget)||this.stopAutoScroll()}onContainerDragEnd(){this.stopAutoScroll()}onContainerDrop(){this.stopAutoScroll()}updateAutoScroll(e,t){const i=e.getBoundingClientRect(),s=dt.EDGE_THRESHOLD,r=t-i.left,n=i.right-t;let o=0,a=0;if(r<s&&r>=0?(o=-1,a=1-r/s):n<s&&n>=0&&(o=1,a=1-n/s),o===0){this.stopAutoScroll();return}const c=dt.SCROLL_SPEED_MIN,d=dt.SCROLL_SPEED_MAX;this._autoScrollSpeed=c+(d-c)*a,this._autoScrollDirection=o,this._autoScrollContainer=e,this._autoScrollRafId===null&&(this._autoScrollRafId=requestAnimationFrame(this.autoScrollLoop))}stopAutoScroll(){this._autoScrollRafId!==null&&(cancelAnimationFrame(this._autoScrollRafId),this._autoScrollRafId=null),this._autoScrollDirection=0,this._autoScrollContainer=null,this._autoScrollSpeed=0}async openAddTaskDialog(){const e=this.renderRoot.querySelector("ft-add-task-dialog");await(e==null?void 0:e.show())}async onColumnAddTask(e){var r;if(this.readOnly||((r=this.capabilities)==null?void 0:r.canCreateTask)===!1)return;const{stage:t,label:i}=e.detail,s=this.renderRoot.querySelector("ft-add-task-dialog");s==null||s.setTarget(t,i),await(s==null?void 0:s.show())}async onTaskCreate(e){var i;if(this.readOnly||((i=this.capabilities)==null?void 0:i.canCreateTask)===!1)return;const t=e.currentTarget;if(!this.client){t.setError("Failed to create task. Please try again.");return}t.setCreating(!0);try{const s=await this.client.createTask(e.detail);this.store.upsert(e.detail.stage?{...s,stage:e.detail.stage,phase:wd(e.detail.stage)}:s),t.close()}catch(s){console.error("Failed to create task",s),t.setError("Failed to create task. Please try again.")}finally{t.setCreating(!1)}}onColumnNav(e){const{direction:t,fromIndex:i,stage:s}=e.detail,r=this.columnsForStage(s),n=r.findIndex(a=>a.stage===s);if(n===-1)return;const o=t==="left"?-1:1;for(let a=n+o;a>=0&&a<r.length;a+=o){const c=r[a],d=this.getColumnTasks(c.stage).length;if(d===0)continue;const l=this.renderedColumnForStage(c.stage);if(!l)return;l.focusTaskAt(Math.min(i,d-1));return}}columnsForStage(e){return Do.some(t=>t.stage===e)?Do:_d}renderedColumnForStage(e){return Array.from(this.renderRoot.querySelectorAll("ft-kanban-column")).find(t=>t.stage===e)}render(){var s;const e=Do.map(r=>{const n=this.store.getByStage(r.stage);return{...r,tasks:n.filter(o=>this.matchesFilters(o)),totalCount:n.length}}),t=_d.map(r=>{const n=this.store.getByStage(r.stage);return{...r,tasks:n.filter(o=>this.matchesFilters(o)),totalCount:n.length}}),i=t.reduce((r,n)=>r+n.tasks.length,0);return T`
      ${this.readOnly||((s=this.capabilities)==null?void 0:s.canCreateTask)===!1?Z:T`<div class="view-header">
        <sl-button size="small" variant="primary" @click=${this.openAddTaskDialog}>
          <sl-icon name="plus" slot="prefix"></sl-icon>
          Add Task
        </sl-button>
      </div>`}

      <div
        class="board"
        @stage-change=${this.onStageChange}
        @task-update=${this.onTaskUpdate}
        @column-add-task=${this.onColumnAddTask}
        @column-nav=${this.onColumnNav}
        @dragover=${this.onContainerDragOver}
        @dragleave=${this.onContainerDragLeave}
        @dragend=${this.onContainerDragEnd}
        @drop=${this.onContainerDrop}
      >
        ${e.map(r=>T`
            <ft-kanban-column
              .stage=${r.stage}
              .tasks=${r.tasks}
              .label=${r.label}
              .totalCount=${r.totalCount}
              ?readOnly=${this.readOnly}
              .capabilities=${this.capabilities}
              selected-task-id=${this.selectedTaskId??""}
            ></ft-kanban-column>
          `)}
      </div>

      ${i>0?T`
            <div class="on-hold-section">
              <div class="on-hold-header" @click=${this.toggleOnHold}>
                <sl-icon
                  name=${this.onHoldExpanded?"chevron-down":"chevron-right"}
                ></sl-icon>
                On Hold
                <span class="on-hold-count">${i}</span>
              </div>
              ${this.onHoldExpanded?T`
                    <div
                      class="on-hold-columns"
                      @stage-change=${this.onStageChange}
                      @task-update=${this.onTaskUpdate}
                      @column-add-task=${this.onColumnAddTask}
                      @column-nav=${this.onColumnNav}
                      @dragover=${this.onContainerDragOver}
                      @dragleave=${this.onContainerDragLeave}
                      @dragend=${this.onContainerDragEnd}
                      @drop=${this.onContainerDrop}
                    >
                      ${t.map(r=>T`
                          <ft-kanban-column
                            .stage=${r.stage}
                            .tasks=${r.tasks}
                            .label=${r.label}
                            .totalCount=${r.totalCount}
                            ?readOnly=${this.readOnly}
                            .capabilities=${this.capabilities}
                            selected-task-id=${this.selectedTaskId??""}
                          ></ft-kanban-column>
                        `)}
                    </div>
                  `:Z}
            </div>
          `:Z}

      <ft-add-task-dialog @task-create=${this.onTaskCreate}></ft-add-task-dialog>
    `}};dt.styles=ee`
    :host {
      display: flex;
      flex-direction: column;
    }
    .board {
      display: flex;
      gap: 0.75rem;
      overflow: auto;
      padding-bottom: 0.5rem;
    }
    .view-header {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 0.75rem;
    }
    .on-hold-section {
      border-top: 1px solid var(--sl-color-neutral-200);
      padding-top: 0.75rem;
      margin-top: 0.5rem;
    }
    .on-hold-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--sl-color-neutral-500);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 0.5rem;
      user-select: none;
    }
    .on-hold-header sl-icon {
      transition: transform 0.2s;
    }
    .on-hold-columns {
      display: flex;
      gap: 0.75rem;
      overflow: auto;
      padding-bottom: 0.5rem;
    }
    .on-hold-count {
      background: var(--sl-color-neutral-200);
      color: var(--sl-color-neutral-600);
      border-radius: 999px;
      padding: 0.1rem 0.45rem;
      font-size: 0.7rem;
    }
  `;dt.EDGE_THRESHOLD=50;dt.SCROLL_SPEED_MIN=2;dt.SCROLL_SPEED_MAX=12;Vi([k({attribute:!1})],dt.prototype,"store",2);Vi([k({attribute:"selected-task-id"})],dt.prototype,"selectedTaskId",2);Vi([k({attribute:!1})],dt.prototype,"client",2);Vi([k({attribute:!1})],dt.prototype,"phaseFilter",2);Vi([k({attribute:!1})],dt.prototype,"assigneeFilter",2);Vi([k({type:Boolean})],dt.prototype,"readOnly",2);Vi([k({attribute:!1})],dt.prototype,"capabilities",2);Vi([U()],dt.prototype,"onHoldExpanded",2);dt=Vi([Oe("ft-kanban-view")],dt);var Jb=Object.defineProperty,Zb=Object.getOwnPropertyDescriptor,nr=(e,t,i,s)=>{for(var r=s>1?void 0:s?Zb(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&Jb(t,i,r),r};const Qb={[W.TRIAGE]:"#6b7280",[W.ACCEPTED]:"#3b82f6",[W.WORKING]:"#f59e0b",[W.IN_REVIEW]:"#8b5cf6",[W.IN_QA]:"#06b6d4",[W.DEPLOYING]:"#ec4899",[W.COMPLETED]:"#22c55e",[W.WONT_FIX]:"#6b7280",[W.DUPLICATE]:"#6b7280",[W.CANCELLED]:"#6b7280"},ev={[W.TRIAGE]:"Triage",[W.ACCEPTED]:"Accepted",[W.WORKING]:"Working",[W.IN_REVIEW]:"Review",[W.IN_QA]:"QA",[W.DEPLOYING]:"Deploy",[W.COMPLETED]:"Done",[W.WONT_FIX]:"Won't Fix",[W.DUPLICATE]:"Duplicate",[W.CANCELLED]:"Cancelled"},tv={[Q.URGENT]:"#ef4444",[Q.HIGH]:"#f97316",[Q.NORMAL]:"#3b82f6",[Q.LOW]:"#9ca3af"},kd=30,iv=2;let ss=class extends ye{constructor(){super(...arguments),this.selected=!1,this.readOnly=!1,this.childCount=0,this.expanded=!0}onDragStart(e){e.dataTransfer.setData("application/ft-task-id",this.task.id),e.dataTransfer.setData("application/ft-subtree","true"),e.dataTransfer.effectAllowed="move"}onToggleExpand(e){e.stopPropagation(),this.dispatchEvent(new CustomEvent("toggle-expand",{detail:{taskId:this.task.id},bubbles:!0,composed:!0}))}render(){const e=this.task,t=e.name.length>kd?e.name.slice(0,kd)+"…":e.name,i=Qb[e.stage]??"#6b7280",s=ev[e.stage]??"",r=tv[e.priority??Q.UNSPECIFIED]??"#3b82f6",n=e.labels.slice(0,iv),o=e.assignees[0];return T`
      <div
        class="node ${this.selected?"selected":""}"
        style="--node-stage-color: ${i}; --node-priority-color: ${r}"
        draggable=${this.readOnly?"false":"true"}
        @dragstart=${this.onDragStart}
      >
        <div class="title">${t}</div>
        <div class="meta">
          ${s?T`<span class="stage-badge">${s}</span>`:Z}
          ${o?T`<span class="assignee">${o.name}</span>`:Z}
        </div>
        ${n.length>0||this.childCount>0?T`
              <div class="bottom">
                ${n.map(a=>T`<span class="label-tag">${a}</span>`)}
                ${this.childCount>0?T`<span
                      class="child-count"
                      @click=${this.onToggleExpand}
                      >${this.expanded?`[−${this.childCount}]`:`[+${this.childCount}]`}</span
                    >`:Z}
              </div>
            `:Z}
      </div>
    `}};ss.styles=ee`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
    }
    .node {
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      background: var(--sl-color-neutral-0);
      border: 2px solid var(--node-stage-color, #6b7280);
      border-left: 5px solid var(--node-priority-color, #3b82f6);
      border-radius: 8px;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      cursor: pointer;
      overflow: hidden;
      font-family: var(--sl-font-sans, sans-serif);
      font-size: 13px;
      color: var(--sl-color-neutral-900);
    }
    .node.selected {
      border-color: var(--sl-color-primary-500);
      border-width: 3px;
      border-left-width: 5px;
      box-shadow: 0 0 0 3px transparent, 0 0 0 6px rgba(99, 102, 241, 0.45);
    }
    .title {
      font-weight: 600;
      font-size: 13px;
      line-height: 1.4;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 2px;
    }
    .stage-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      color: #fff;
      background: var(--node-stage-color, #6b7280);
      white-space: nowrap;
    }
    .assignee {
      font-size: 11px;
      color: var(--sl-color-neutral-500);
      margin-left: auto;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 70px;
    }
    .bottom {
      display: flex;
      align-items: center;
      gap: 3px;
      margin-top: 2px;
    }
    .label-tag {
      display: inline-block;
      padding: 0 4px;
      border-radius: 3px;
      font-size: 10px;
      letter-spacing: 0.04em;
      background: var(--sl-color-neutral-200);
      color: var(--sl-color-neutral-700);
      white-space: nowrap;
    }
    .child-count {
      margin-left: auto;
      font-size: 11px;
      color: var(--sl-color-neutral-500);
      font-weight: 600;
      cursor: pointer;
      padding: 0 2px;
      border-radius: 3px;
    }
    .child-count:hover {
      background: var(--sl-color-neutral-200);
      color: var(--sl-color-neutral-900);
    }
  `;nr([k({attribute:!1})],ss.prototype,"task",2);nr([k({type:Boolean})],ss.prototype,"selected",2);nr([k({type:Boolean})],ss.prototype,"readOnly",2);nr([k({type:Number})],ss.prototype,"childCount",2);nr([k({type:Boolean})],ss.prototype,"expanded",2);ss=nr([Oe("ft-tree-node")],ss);var sv=Object.defineProperty,rv=Object.getOwnPropertyDescriptor,Rs=(e,t,i,s)=>{for(var r=s>1?void 0:s?rv(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&sv(t,i,r),r};let Ui=class extends ye{constructor(){super(...arguments),this.focusRootId=null,this.isolateMode=!1,this.selectedTaskId=null,this.maxDepth=-1,this.layoutOrientation="LR"}getMaxLevel(){let e=0;const t=(s,r)=>{r>e&&(e=r);for(const n of this.store.getChildren(s))t(n.id,r+1)},i=this.isolateMode&&this.selectedTaskId?this.selectedTaskId:this.focusRootId;if(i){const s=this.store.getTask(i);s&&t(s.id,0)}else for(const s of this.store.roots)t(s.id,0);return e}getBreadcrumbTrail(){if(!this.focusRootId)return[];const e=[];let t=this.store.getTask(this.focusRootId);for(;t;)e.unshift({id:t.id,name:t.name}),t=t.parentTaskId?this.store.getTask(t.parentTaskId):void 0;return e}onLevelChange(e){const t=e.target,i=parseInt(t.value,10);this.dispatchEvent(new CustomEvent("level-change",{detail:{maxDepth:i},bubbles:!0,composed:!0}))}onIsolateClick(){this.dispatchEvent(new CustomEvent("isolate-toggle",{detail:{isolateMode:!this.isolateMode},bubbles:!0,composed:!0}))}onOrientationToggle(){const e=this.layoutOrientation==="TB"?"LR":"TB";this.dispatchEvent(new CustomEvent("layout-orientation-toggle",{detail:{layoutOrientation:e},bubbles:!0,composed:!0}))}onCrumbClick(e){this.dispatchEvent(new CustomEvent("focus-change",{detail:{focusRootId:e},bubbles:!0,composed:!0}))}render(){const e=this.getMaxLevel(),t=[];for(let r=0;r<=e;r++)t.push(r);const i=this.getBreadcrumbTrail(),s=this.maxDepth>=0&&this.maxDepth<e;return T`
      <sl-select
        size="small"
        value=${String(this.maxDepth)}
        @sl-change=${this.onLevelChange}
      >
        <sl-option value="-1">All Levels</sl-option>
        ${t.map(r=>T`
            <sl-option value=${String(r)}>
              Level ${r}${r===0?" (Roots)":""}
            </sl-option>
          `)}
      </sl-select>

      ${s?T`<span class="depth-badge">
            <sl-icon name="layers"></sl-icon>
            ${e-this.maxDepth} deeper level${e-this.maxDepth!==1?"s":""} hidden
          </span>`:Z}

      <sl-tooltip content=${this.isolateMode?"Show full tree":"Solo selected task and its descendants"}>
        <button
          class="isolate-btn ${this.isolateMode?"active":""}"
          ?disabled=${!this.selectedTaskId}
          @click=${this.onIsolateClick}
        >
          <sl-icon name=${this.isolateMode?"fullscreen-exit":"funnel"}></sl-icon>
          Solo
        </button>
      </sl-tooltip>

      <sl-tooltip content=${this.layoutOrientation==="LR"?"Switch to top-down layout":"Switch to left-to-right layout"}>
        <button
          class="isolate-btn"
          @click=${this.onOrientationToggle}
        >
          <sl-icon name=${this.layoutOrientation==="LR"?"arrow-clockwise":"arrow-counterclockwise"}></sl-icon>
        </button>
      </sl-tooltip>

      ${i.length>0?T`
            <div class="breadcrumbs">
              <span class="crumb" @click=${()=>this.onCrumbClick(null)}
                >Root</span
              >
              ${i.map((r,n)=>T`
                  <span class="separator">›</span>
                  ${n<i.length-1?T`<span
                        class="crumb"
                        @click=${()=>this.onCrumbClick(r.id)}
                        >${r.name}</span
                      >`:T`<span class="current">${r.name}</span>`}
                `)}
            </div>
          `:Z}
    `}};Ui.styles=ee`
    :host {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      background: var(--sl-color-neutral-50, #1e1e2e);
      border-bottom: 1px solid var(--sl-color-neutral-200, #334155);
      font-family: var(--sl-font-sans, sans-serif);
      flex-shrink: 0;
    }
    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.85rem;
    }
    .crumb {
      cursor: pointer;
      color: var(--sl-color-primary-600, #818cf8);
    }
    .crumb:hover {
      text-decoration: underline;
    }
    .separator {
      color: var(--sl-color-neutral-400, #64748b);
    }
    .current {
      color: var(--sl-color-neutral-700, #cbd5e1);
      font-weight: 600;
    }
    sl-select {
      min-width: 150px;
    }
    .isolate-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.25rem 0.6rem;
      border: 1px solid var(--sl-color-neutral-300, #475569);
      border-radius: var(--sl-border-radius-medium, 4px);
      background: var(--sl-color-neutral-0, #fff);
      color: var(--sl-color-neutral-700, #cbd5e1);
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
      font-family: inherit;
      line-height: 1.4;
    }
    .isolate-btn:hover {
      background: var(--sl-color-neutral-100, #334155);
      border-color: var(--sl-color-neutral-400, #64748b);
    }
    .isolate-btn.active {
      background: var(--sl-color-primary-100, #312e81);
      border-color: var(--sl-color-primary-500, #6366f1);
      color: var(--sl-color-primary-700, #a5b4fc);
    }
    .isolate-btn.active:hover {
      background: var(--sl-color-primary-200, #3730a3);
    }
    .isolate-btn sl-icon {
      font-size: 0.9rem;
    }
    .isolate-btn[disabled] {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .depth-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.15rem 0.5rem;
      border-radius: var(--sl-border-radius-pill, 9999px);
      background: var(--sl-color-warning-100, #451a03);
      color: var(--sl-color-warning-700, #fbbf24);
      font-size: 0.75rem;
      font-weight: 500;
      white-space: nowrap;
    }
    .depth-badge sl-icon {
      font-size: 0.8rem;
    }
  `;Rs([k({attribute:!1})],Ui.prototype,"store",2);Rs([k({type:String})],Ui.prototype,"focusRootId",2);Rs([k({type:Boolean})],Ui.prototype,"isolateMode",2);Rs([k({type:String})],Ui.prototype,"selectedTaskId",2);Rs([k({type:Number})],Ui.prototype,"maxDepth",2);Rs([k({type:String})],Ui.prototype,"layoutOrientation",2);Ui=Rs([Oe("ft-hierarchy-nav")],Ui);var Us=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};function kp(e){return e&&e.__esModule&&Object.prototype.hasOwnProperty.call(e,"default")?e.default:e}function nv(e){if(Object.prototype.hasOwnProperty.call(e,"__esModule"))return e;var t=e.default;if(typeof t=="function"){var i=function s(){return this instanceof s?Reflect.construct(t,arguments,this.constructor):t.apply(this,arguments)};i.prototype=t.prototype}else i={};return Object.defineProperty(i,"__esModule",{value:!0}),Object.keys(e).forEach(function(s){var r=Object.getOwnPropertyDescriptor(e,s);Object.defineProperty(i,s,r.get?r:{enumerable:!0,get:function(){return e[s]}})}),i}var No,Ed;function nc(){if(Ed)return No;Ed=1;var e="\0",t="\0",i="";class s{constructor(l){he(this,"_isDirected",!0);he(this,"_isMultigraph",!1);he(this,"_isCompound",!1);he(this,"_label");he(this,"_defaultNodeLabelFn",()=>{});he(this,"_defaultEdgeLabelFn",()=>{});he(this,"_nodes",{});he(this,"_in",{});he(this,"_preds",{});he(this,"_out",{});he(this,"_sucs",{});he(this,"_edgeObjs",{});he(this,"_edgeLabels",{});he(this,"_nodeCount",0);he(this,"_edgeCount",0);he(this,"_parent");he(this,"_children");l&&(this._isDirected=Object.hasOwn(l,"directed")?l.directed:!0,this._isMultigraph=Object.hasOwn(l,"multigraph")?l.multigraph:!1,this._isCompound=Object.hasOwn(l,"compound")?l.compound:!1),this._isCompound&&(this._parent={},this._children={},this._children[t]={})}isDirected(){return this._isDirected}isMultigraph(){return this._isMultigraph}isCompound(){return this._isCompound}setGraph(l){return this._label=l,this}graph(){return this._label}setDefaultNodeLabel(l){return this._defaultNodeLabelFn=l,typeof l!="function"&&(this._defaultNodeLabelFn=()=>l),this}nodeCount(){return this._nodeCount}nodes(){return Object.keys(this._nodes)}sources(){var l=this;return this.nodes().filter(u=>Object.keys(l._in[u]).length===0)}sinks(){var l=this;return this.nodes().filter(u=>Object.keys(l._out[u]).length===0)}setNodes(l,u){var p=arguments,h=this;return l.forEach(function(g){p.length>1?h.setNode(g,u):h.setNode(g)}),this}setNode(l,u){return Object.hasOwn(this._nodes,l)?(arguments.length>1&&(this._nodes[l]=u),this):(this._nodes[l]=arguments.length>1?u:this._defaultNodeLabelFn(l),this._isCompound&&(this._parent[l]=t,this._children[l]={},this._children[t][l]=!0),this._in[l]={},this._preds[l]={},this._out[l]={},this._sucs[l]={},++this._nodeCount,this)}node(l){return this._nodes[l]}hasNode(l){return Object.hasOwn(this._nodes,l)}removeNode(l){var u=this;if(Object.hasOwn(this._nodes,l)){var p=h=>u.removeEdge(u._edgeObjs[h]);delete this._nodes[l],this._isCompound&&(this._removeFromParentsChildList(l),delete this._parent[l],this.children(l).forEach(function(h){u.setParent(h)}),delete this._children[l]),Object.keys(this._in[l]).forEach(p),delete this._in[l],delete this._preds[l],Object.keys(this._out[l]).forEach(p),delete this._out[l],delete this._sucs[l],--this._nodeCount}return this}setParent(l,u){if(!this._isCompound)throw new Error("Cannot set parent in a non-compound graph");if(u===void 0)u=t;else{u+="";for(var p=u;p!==void 0;p=this.parent(p))if(p===l)throw new Error("Setting "+u+" as parent of "+l+" would create a cycle");this.setNode(u)}return this.setNode(l),this._removeFromParentsChildList(l),this._parent[l]=u,this._children[u][l]=!0,this}_removeFromParentsChildList(l){delete this._children[this._parent[l]][l]}parent(l){if(this._isCompound){var u=this._parent[l];if(u!==t)return u}}children(l=t){if(this._isCompound){var u=this._children[l];if(u)return Object.keys(u)}else{if(l===t)return this.nodes();if(this.hasNode(l))return[]}}predecessors(l){var u=this._preds[l];if(u)return Object.keys(u)}successors(l){var u=this._sucs[l];if(u)return Object.keys(u)}neighbors(l){var u=this.predecessors(l);if(u){const h=new Set(u);for(var p of this.successors(l))h.add(p);return Array.from(h.values())}}isLeaf(l){var u;return this.isDirected()?u=this.successors(l):u=this.neighbors(l),u.length===0}filterNodes(l){var u=new this.constructor({directed:this._isDirected,multigraph:this._isMultigraph,compound:this._isCompound});u.setGraph(this.graph());var p=this;Object.entries(this._nodes).forEach(function([f,m]){l(f)&&u.setNode(f,m)}),Object.values(this._edgeObjs).forEach(function(f){u.hasNode(f.v)&&u.hasNode(f.w)&&u.setEdge(f,p.edge(f))});var h={};function g(f){var m=p.parent(f);return m===void 0||u.hasNode(m)?(h[f]=m,m):m in h?h[m]:g(m)}return this._isCompound&&u.nodes().forEach(f=>u.setParent(f,g(f))),u}setDefaultEdgeLabel(l){return this._defaultEdgeLabelFn=l,typeof l!="function"&&(this._defaultEdgeLabelFn=()=>l),this}edgeCount(){return this._edgeCount}edges(){return Object.values(this._edgeObjs)}setPath(l,u){var p=this,h=arguments;return l.reduce(function(g,f){return h.length>1?p.setEdge(g,f,u):p.setEdge(g,f),f}),this}setEdge(){var l,u,p,h,g=!1,f=arguments[0];typeof f=="object"&&f!==null&&"v"in f?(l=f.v,u=f.w,p=f.name,arguments.length===2&&(h=arguments[1],g=!0)):(l=f,u=arguments[1],p=arguments[3],arguments.length>2&&(h=arguments[2],g=!0)),l=""+l,u=""+u,p!==void 0&&(p=""+p);var m=o(this._isDirected,l,u,p);if(Object.hasOwn(this._edgeLabels,m))return g&&(this._edgeLabels[m]=h),this;if(p!==void 0&&!this._isMultigraph)throw new Error("Cannot set a named edge when isMultigraph = false");this.setNode(l),this.setNode(u),this._edgeLabels[m]=g?h:this._defaultEdgeLabelFn(l,u,p);var b=a(this._isDirected,l,u,p);return l=b.v,u=b.w,Object.freeze(b),this._edgeObjs[m]=b,r(this._preds[u],l),r(this._sucs[l],u),this._in[u][m]=b,this._out[l][m]=b,this._edgeCount++,this}edge(l,u,p){var h=arguments.length===1?c(this._isDirected,arguments[0]):o(this._isDirected,l,u,p);return this._edgeLabels[h]}edgeAsObj(){const l=this.edge(...arguments);return typeof l!="object"?{label:l}:l}hasEdge(l,u,p){var h=arguments.length===1?c(this._isDirected,arguments[0]):o(this._isDirected,l,u,p);return Object.hasOwn(this._edgeLabels,h)}removeEdge(l,u,p){var h=arguments.length===1?c(this._isDirected,arguments[0]):o(this._isDirected,l,u,p),g=this._edgeObjs[h];return g&&(l=g.v,u=g.w,delete this._edgeLabels[h],delete this._edgeObjs[h],n(this._preds[u],l),n(this._sucs[l],u),delete this._in[u][h],delete this._out[l][h],this._edgeCount--),this}inEdges(l,u){var p=this._in[l];if(p){var h=Object.values(p);return u?h.filter(g=>g.v===u):h}}outEdges(l,u){var p=this._out[l];if(p){var h=Object.values(p);return u?h.filter(g=>g.w===u):h}}nodeEdges(l,u){var p=this.inEdges(l,u);if(p)return p.concat(this.outEdges(l,u))}}function r(d,l){d[l]?d[l]++:d[l]=1}function n(d,l){--d[l]||delete d[l]}function o(d,l,u,p){var h=""+l,g=""+u;if(!d&&h>g){var f=h;h=g,g=f}return h+i+g+i+(p===void 0?e:p)}function a(d,l,u,p){var h=""+l,g=""+u;if(!d&&h>g){var f=h;h=g,g=f}var m={v:h,w:g};return p&&(m.name=p),m}function c(d,l){return o(d,l.v,l.w,l.name)}return No=s,No}var Lo,xd;function ov(){return xd||(xd=1,Lo="2.2.4"),Lo}var Po,Td;function av(){return Td||(Td=1,Po={Graph:nc(),version:ov()}),Po}var Mo,Cd;function lv(){if(Cd)return Mo;Cd=1;var e=nc();Mo={write:t,read:r};function t(n){var o={options:{directed:n.isDirected(),multigraph:n.isMultigraph(),compound:n.isCompound()},nodes:i(n),edges:s(n)};return n.graph()!==void 0&&(o.value=structuredClone(n.graph())),o}function i(n){return n.nodes().map(function(o){var a=n.node(o),c=n.parent(o),d={v:o};return a!==void 0&&(d.value=a),c!==void 0&&(d.parent=c),d})}function s(n){return n.edges().map(function(o){var a=n.edge(o),c={v:o.v,w:o.w};return o.name!==void 0&&(c.name=o.name),a!==void 0&&(c.value=a),c})}function r(n){var o=new e(n.options).setGraph(n.value);return n.nodes.forEach(function(a){o.setNode(a.v,a.value),a.parent&&o.setParent(a.v,a.parent)}),n.edges.forEach(function(a){o.setEdge({v:a.v,w:a.w,name:a.name},a.value)}),o}return Mo}var Fo,Sd;function cv(){if(Sd)return Fo;Sd=1,Fo=e;function e(t){var i={},s=[],r;function n(o){Object.hasOwn(i,o)||(i[o]=!0,r.push(o),t.successors(o).forEach(n),t.predecessors(o).forEach(n))}return t.nodes().forEach(function(o){r=[],n(o),r.length&&s.push(r)}),s}return Fo}var zo,Od;function Ep(){if(Od)return zo;Od=1;class e{constructor(){he(this,"_arr",[]);he(this,"_keyIndices",{})}size(){return this._arr.length}keys(){return this._arr.map(function(i){return i.key})}has(i){return Object.hasOwn(this._keyIndices,i)}priority(i){var s=this._keyIndices[i];if(s!==void 0)return this._arr[s].priority}min(){if(this.size()===0)throw new Error("Queue underflow");return this._arr[0].key}add(i,s){var r=this._keyIndices;if(i=String(i),!Object.hasOwn(r,i)){var n=this._arr,o=n.length;return r[i]=o,n.push({key:i,priority:s}),this._decrease(o),!0}return!1}removeMin(){this._swap(0,this._arr.length-1);var i=this._arr.pop();return delete this._keyIndices[i.key],this._heapify(0),i.key}decrease(i,s){var r=this._keyIndices[i];if(s>this._arr[r].priority)throw new Error("New priority is greater than current priority. Key: "+i+" Old: "+this._arr[r].priority+" New: "+s);this._arr[r].priority=s,this._decrease(r)}_heapify(i){var s=this._arr,r=2*i,n=r+1,o=i;r<s.length&&(o=s[r].priority<s[o].priority?r:o,n<s.length&&(o=s[n].priority<s[o].priority?n:o),o!==i&&(this._swap(i,o),this._heapify(o)))}_decrease(i){for(var s=this._arr,r=s[i].priority,n;i!==0&&(n=i>>1,!(s[n].priority<r));)this._swap(i,n),i=n}_swap(i,s){var r=this._arr,n=this._keyIndices,o=r[i],a=r[s];r[i]=a,r[s]=o,n[a.key]=i,n[o.key]=s}}return zo=e,zo}var Bo,Ad;function xp(){if(Ad)return Bo;Ad=1;var e=Ep();Bo=i;var t=()=>1;function i(r,n,o,a){return s(r,String(n),o||t,a||function(c){return r.outEdges(c)})}function s(r,n,o,a){var c={},d=new e,l,u,p=function(h){var g=h.v!==l?h.v:h.w,f=c[g],m=o(h),b=u.distance+m;if(m<0)throw new Error("dijkstra does not allow negative edge weights. Bad edge: "+h+" Weight: "+m);b<f.distance&&(f.distance=b,f.predecessor=l,d.decrease(g,b))};for(r.nodes().forEach(function(h){var g=h===n?0:Number.POSITIVE_INFINITY;c[h]={distance:g},d.add(h,g)});d.size()>0&&(l=d.removeMin(),u=c[l],u.distance!==Number.POSITIVE_INFINITY);)a(l).forEach(p);return c}return Bo}var Uo,Id;function dv(){if(Id)return Uo;Id=1;var e=xp();Uo=t;function t(i,s,r){return i.nodes().reduce(function(n,o){return n[o]=e(i,o,s,r),n},{})}return Uo}var qo,Rd;function Tp(){if(Rd)return qo;Rd=1,qo=e;function e(t){var i=0,s=[],r={},n=[];function o(a){var c=r[a]={onStack:!0,lowlink:i,index:i++};if(s.push(a),t.successors(a).forEach(function(u){Object.hasOwn(r,u)?r[u].onStack&&(c.lowlink=Math.min(c.lowlink,r[u].index)):(o(u),c.lowlink=Math.min(c.lowlink,r[u].lowlink))}),c.lowlink===c.index){var d=[],l;do l=s.pop(),r[l].onStack=!1,d.push(l);while(a!==l);n.push(d)}}return t.nodes().forEach(function(a){Object.hasOwn(r,a)||o(a)}),n}return qo}var Ho,$d;function uv(){if($d)return Ho;$d=1;var e=Tp();Ho=t;function t(i){return e(i).filter(function(s){return s.length>1||s.length===1&&i.hasEdge(s[0],s[0])})}return Ho}var Vo,Dd;function hv(){if(Dd)return Vo;Dd=1,Vo=t;var e=()=>1;function t(s,r,n){return i(s,r||e,n||function(o){return s.outEdges(o)})}function i(s,r,n){var o={},a=s.nodes();return a.forEach(function(c){o[c]={},o[c][c]={distance:0},a.forEach(function(d){c!==d&&(o[c][d]={distance:Number.POSITIVE_INFINITY})}),n(c).forEach(function(d){var l=d.v===c?d.w:d.v,u=r(d);o[c][l]={distance:u,predecessor:c}})}),a.forEach(function(c){var d=o[c];a.forEach(function(l){var u=o[l];a.forEach(function(p){var h=u[c],g=d[p],f=u[p],m=h.distance+g.distance;m<f.distance&&(f.distance=m,f.predecessor=g.predecessor)})})}),o}return Vo}var jo,Nd;function Cp(){if(Nd)return jo;Nd=1;function e(i){var s={},r={},n=[];function o(a){if(Object.hasOwn(r,a))throw new t;Object.hasOwn(s,a)||(r[a]=!0,s[a]=!0,i.predecessors(a).forEach(o),delete r[a],n.push(a))}if(i.sinks().forEach(o),Object.keys(s).length!==i.nodeCount())throw new t;return n}class t extends Error{constructor(){super(...arguments)}}return jo=e,e.CycleException=t,jo}var Go,Ld;function pv(){if(Ld)return Go;Ld=1;var e=Cp();Go=t;function t(i){try{e(i)}catch(s){if(s instanceof e.CycleException)return!1;throw s}return!0}return Go}var Wo,Pd;function Sp(){if(Pd)return Wo;Pd=1,Wo=e;function e(r,n,o){Array.isArray(n)||(n=[n]);var a=r.isDirected()?u=>r.successors(u):u=>r.neighbors(u),c=o==="post"?t:i,d=[],l={};return n.forEach(u=>{if(!r.hasNode(u))throw new Error("Graph does not have node: "+u);c(u,a,l,d)}),d}function t(r,n,o,a){for(var c=[[r,!1]];c.length>0;){var d=c.pop();d[1]?a.push(d[0]):Object.hasOwn(o,d[0])||(o[d[0]]=!0,c.push([d[0],!0]),s(n(d[0]),l=>c.push([l,!1])))}}function i(r,n,o,a){for(var c=[r];c.length>0;){var d=c.pop();Object.hasOwn(o,d)||(o[d]=!0,a.push(d),s(n(d),l=>c.push(l)))}}function s(r,n){for(var o=r.length;o--;)n(r[o],o,r);return r}return Wo}var Yo,Md;function fv(){if(Md)return Yo;Md=1;var e=Sp();Yo=t;function t(i,s){return e(i,s,"post")}return Yo}var Ko,Fd;function mv(){if(Fd)return Ko;Fd=1;var e=Sp();Ko=t;function t(i,s){return e(i,s,"pre")}return Ko}var Xo,zd;function gv(){if(zd)return Xo;zd=1;var e=nc(),t=Ep();Xo=i;function i(s,r){var n=new e,o={},a=new t,c;function d(u){var p=u.v===c?u.w:u.v,h=a.priority(p);if(h!==void 0){var g=r(u);g<h&&(o[p]=c,a.decrease(p,g))}}if(s.nodeCount()===0)return n;s.nodes().forEach(function(u){a.add(u,Number.POSITIVE_INFINITY),n.setNode(u)}),a.decrease(s.nodes()[0],0);for(var l=!1;a.size()>0;){if(c=a.removeMin(),Object.hasOwn(o,c))n.setEdge(c,o[c]);else{if(l)throw new Error("Input graph is not connected: "+s);l=!0}s.nodeEdges(c).forEach(d)}return n}return Xo}var Jo,Bd;function bv(){return Bd||(Bd=1,Jo={components:cv(),dijkstra:xp(),dijkstraAll:dv(),findCycles:uv(),floydWarshall:hv(),isAcyclic:pv(),postorder:fv(),preorder:mv(),prim:gv(),tarjan:Tp(),topsort:Cp()}),Jo}var Zo,Ud;function ri(){if(Ud)return Zo;Ud=1;var e=av();return Zo={Graph:e.Graph,json:lv(),alg:bv(),version:e.version},Zo}var Qo,qd;function vv(){if(qd)return Qo;qd=1;class e{constructor(){let r={};r._next=r._prev=r,this._sentinel=r}dequeue(){let r=this._sentinel,n=r._prev;if(n!==r)return t(n),n}enqueue(r){let n=this._sentinel;r._prev&&r._next&&t(r),r._next=n._next,n._next._prev=r,n._next=r,r._prev=n}toString(){let r=[],n=this._sentinel,o=n._prev;for(;o!==n;)r.push(JSON.stringify(o,i)),o=o._prev;return"["+r.join(", ")+"]"}}function t(s){s._prev._next=s._next,s._next._prev=s._prev,delete s._next,delete s._prev}function i(s,r){if(s!=="_next"&&s!=="_prev")return r}return Qo=e,Qo}var ea,Hd;function yv(){if(Hd)return ea;Hd=1;let e=ri().Graph,t=vv();ea=s;let i=()=>1;function s(d,l){if(d.nodeCount()<=1)return[];let u=o(d,l||i);return r(u.graph,u.buckets,u.zeroIdx).flatMap(h=>d.outEdges(h.v,h.w))}function r(d,l,u){let p=[],h=l[l.length-1],g=l[0],f;for(;d.nodeCount();){for(;f=g.dequeue();)n(d,l,u,f);for(;f=h.dequeue();)n(d,l,u,f);if(d.nodeCount()){for(let m=l.length-2;m>0;--m)if(f=l[m].dequeue(),f){p=p.concat(n(d,l,u,f,!0));break}}}return p}function n(d,l,u,p,h){let g=h?[]:void 0;return d.inEdges(p.v).forEach(f=>{let m=d.edge(f),b=d.node(f.v);h&&g.push({v:f.v,w:f.w}),b.out-=m,a(l,u,b)}),d.outEdges(p.v).forEach(f=>{let m=d.edge(f),b=f.w,v=d.node(b);v.in-=m,a(l,u,v)}),d.removeNode(p.v),g}function o(d,l){let u=new e,p=0,h=0;d.nodes().forEach(m=>{u.setNode(m,{v:m,in:0,out:0})}),d.edges().forEach(m=>{let b=u.edge(m.v,m.w)||0,v=l(m),y=b+v;u.setEdge(m.v,m.w,y),h=Math.max(h,u.node(m.v).out+=v),p=Math.max(p,u.node(m.w).in+=v)});let g=c(h+p+3).map(()=>new t),f=p+1;return u.nodes().forEach(m=>{a(g,f,u.node(m))}),{graph:u,buckets:g,zeroIdx:f}}function a(d,l,u){u.out?u.in?d[u.out-u.in+l].enqueue(u):d[d.length-1].enqueue(u):d[0].enqueue(u)}function c(d){const l=[];for(let u=0;u<d;u++)l.push(u);return l}return ea}var ta,Vd;function Je(){if(Vd)return ta;Vd=1;let e=ri().Graph;ta={addBorderNode:l,addDummyNode:t,applyWithChunking:h,asNonCompoundGraph:s,buildLayerMatrix:a,intersectRect:o,mapValues:O,maxRank:g,normalizeRanks:c,notime:b,partition:f,pick:C,predecessorWeights:n,range:w,removeEmptyRanks:d,simplify:i,successorWeights:r,time:m,uniqueId:y,zipObject:M};function t(A,R,D,F){for(var P=F;A.hasNode(P);)P=y(F);return D.dummy=R,A.setNode(P,D),P}function i(A){let R=new e().setGraph(A.graph());return A.nodes().forEach(D=>R.setNode(D,A.node(D))),A.edges().forEach(D=>{let F=R.edge(D.v,D.w)||{weight:0,minlen:1},P=A.edge(D);R.setEdge(D.v,D.w,{weight:F.weight+P.weight,minlen:Math.max(F.minlen,P.minlen)})}),R}function s(A){let R=new e({multigraph:A.isMultigraph()}).setGraph(A.graph());return A.nodes().forEach(D=>{A.children(D).length||R.setNode(D,A.node(D))}),A.edges().forEach(D=>{R.setEdge(D,A.edge(D))}),R}function r(A){let R=A.nodes().map(D=>{let F={};return A.outEdges(D).forEach(P=>{F[P.w]=(F[P.w]||0)+A.edge(P).weight}),F});return M(A.nodes(),R)}function n(A){let R=A.nodes().map(D=>{let F={};return A.inEdges(D).forEach(P=>{F[P.v]=(F[P.v]||0)+A.edge(P).weight}),F});return M(A.nodes(),R)}function o(A,R){let D=A.x,F=A.y,P=R.x-D,S=R.y-F,I=A.width/2,_=A.height/2;if(!P&&!S)throw new Error("Not possible to find intersection inside of the rectangle");let $,Y;return Math.abs(S)*I>Math.abs(P)*_?(S<0&&(_=-_),$=_*P/S,Y=_):(P<0&&(I=-I),$=I,Y=I*S/P),{x:D+$,y:F+Y}}function a(A){let R=w(g(A)+1).map(()=>[]);return A.nodes().forEach(D=>{let F=A.node(D),P=F.rank;P!==void 0&&(R[P][F.order]=D)}),R}function c(A){let R=A.nodes().map(F=>{let P=A.node(F).rank;return P===void 0?Number.MAX_VALUE:P}),D=h(Math.min,R);A.nodes().forEach(F=>{let P=A.node(F);Object.hasOwn(P,"rank")&&(P.rank-=D)})}function d(A){let R=A.nodes().map(I=>A.node(I).rank),D=h(Math.min,R),F=[];A.nodes().forEach(I=>{let _=A.node(I).rank-D;F[_]||(F[_]=[]),F[_].push(I)});let P=0,S=A.graph().nodeRankFactor;Array.from(F).forEach((I,_)=>{I===void 0&&_%S!==0?--P:I!==void 0&&P&&I.forEach($=>A.node($).rank+=P)})}function l(A,R,D,F){let P={width:0,height:0};return arguments.length>=4&&(P.rank=D,P.order=F),t(A,"border",P,R)}function u(A,R=p){const D=[];for(let F=0;F<A.length;F+=R){const P=A.slice(F,F+R);D.push(P)}return D}const p=65535;function h(A,R){if(R.length>p){const D=u(R);return A.apply(null,D.map(F=>A.apply(null,F)))}else return A.apply(null,R)}function g(A){const D=A.nodes().map(F=>{let P=A.node(F).rank;return P===void 0?Number.MIN_VALUE:P});return h(Math.max,D)}function f(A,R){let D={lhs:[],rhs:[]};return A.forEach(F=>{R(F)?D.lhs.push(F):D.rhs.push(F)}),D}function m(A,R){let D=Date.now();try{return R()}finally{console.log(A+" time: "+(Date.now()-D)+"ms")}}function b(A,R){return R()}let v=0;function y(A){var R=++v;return A+(""+R)}function w(A,R,D=1){R==null&&(R=A,A=0);let F=S=>S<R;D<0&&(F=S=>R<S);const P=[];for(let S=A;F(S);S+=D)P.push(S);return P}function C(A,R){const D={};for(const F of R)A[F]!==void 0&&(D[F]=A[F]);return D}function O(A,R){let D=R;return typeof R=="string"&&(D=F=>F[R]),Object.entries(A).reduce((F,[P,S])=>(F[P]=D(S,P),F),{})}function M(A,R){return A.reduce((D,F,P)=>(D[F]=R[P],D),{})}return ta}var ia,jd;function wv(){if(jd)return ia;jd=1;let e=yv(),t=Je().uniqueId;ia={run:i,undo:r};function i(n){(n.graph().acyclicer==="greedy"?e(n,a(n)):s(n)).forEach(c=>{let d=n.edge(c);n.removeEdge(c),d.forwardName=c.name,d.reversed=!0,n.setEdge(c.w,c.v,d,t("rev"))});function a(c){return d=>c.edge(d).weight}}function s(n){let o=[],a={},c={};function d(l){Object.hasOwn(c,l)||(c[l]=!0,a[l]=!0,n.outEdges(l).forEach(u=>{Object.hasOwn(a,u.w)?o.push(u):d(u.w)}),delete a[l])}return n.nodes().forEach(d),o}function r(n){n.edges().forEach(o=>{let a=n.edge(o);if(a.reversed){n.removeEdge(o);let c=a.forwardName;delete a.reversed,delete a.forwardName,n.setEdge(o.w,o.v,a,c)}})}return ia}var sa,Gd;function _v(){if(Gd)return sa;Gd=1;let e=Je();sa={run:t,undo:s};function t(r){r.graph().dummyChains=[],r.edges().forEach(n=>i(r,n))}function i(r,n){let o=n.v,a=r.node(o).rank,c=n.w,d=r.node(c).rank,l=n.name,u=r.edge(n),p=u.labelRank;if(d===a+1)return;r.removeEdge(n);let h,g,f;for(f=0,++a;a<d;++f,++a)u.points=[],g={width:0,height:0,edgeLabel:u,edgeObj:n,rank:a},h=e.addDummyNode(r,"edge",g,"_d"),a===p&&(g.width=u.width,g.height=u.height,g.dummy="edge-label",g.labelpos=u.labelpos),r.setEdge(o,h,{weight:u.weight},l),f===0&&r.graph().dummyChains.push(h),o=h;r.setEdge(o,c,{weight:u.weight},l)}function s(r){r.graph().dummyChains.forEach(n=>{let o=r.node(n),a=o.edgeLabel,c;for(r.setEdge(o.edgeObj,a);o.dummy;)c=r.successors(n)[0],r.removeNode(n),a.points.push({x:o.x,y:o.y}),o.dummy==="edge-label"&&(a.x=o.x,a.y=o.y,a.width=o.width,a.height=o.height),n=c,o=r.node(n)})}return sa}var ra,Wd;function Ln(){if(Wd)return ra;Wd=1;const{applyWithChunking:e}=Je();ra={longestPath:t,slack:i};function t(s){var r={};function n(o){var a=s.node(o);if(Object.hasOwn(r,o))return a.rank;r[o]=!0;let c=s.outEdges(o).map(l=>l==null?Number.POSITIVE_INFINITY:n(l.w)-s.edge(l).minlen);var d=e(Math.min,c);return d===Number.POSITIVE_INFINITY&&(d=0),a.rank=d}s.sources().forEach(n)}function i(s,r){return s.node(r.w).rank-s.node(r.v).rank-s.edge(r).minlen}return ra}var na,Yd;function Op(){if(Yd)return na;Yd=1;var e=ri().Graph,t=Ln().slack;na=i;function i(o){var a=new e({directed:!1}),c=o.nodes()[0],d=o.nodeCount();a.setNode(c,{});for(var l,u;s(a,o)<d;)l=r(a,o),u=a.hasNode(l.v)?t(o,l):-t(o,l),n(a,o,u);return a}function s(o,a){function c(d){a.nodeEdges(d).forEach(l=>{var u=l.v,p=d===u?l.w:u;!o.hasNode(p)&&!t(a,l)&&(o.setNode(p,{}),o.setEdge(d,p,{}),c(p))})}return o.nodes().forEach(c),o.nodeCount()}function r(o,a){return a.edges().reduce((d,l)=>{let u=Number.POSITIVE_INFINITY;return o.hasNode(l.v)!==o.hasNode(l.w)&&(u=t(a,l)),u<d[0]?[u,l]:d},[Number.POSITIVE_INFINITY,null])[1]}function n(o,a,c){o.nodes().forEach(d=>a.node(d).rank+=c)}return na}var oa,Kd;function kv(){if(Kd)return oa;Kd=1;var e=Op(),t=Ln().slack,i=Ln().longestPath,s=ri().alg.preorder,r=ri().alg.postorder,n=Je().simplify;oa=o,o.initLowLimValues=l,o.initCutValues=a,o.calcCutValue=d,o.leaveEdge=p,o.enterEdge=h,o.exchangeEdges=g;function o(v){v=n(v),i(v);var y=e(v);l(y),a(y,v);for(var w,C;w=p(y);)C=h(y,v,w),g(y,v,w,C)}function a(v,y){var w=r(v,v.nodes());w=w.slice(0,w.length-1),w.forEach(C=>c(v,y,C))}function c(v,y,w){var C=v.node(w),O=C.parent;v.edge(w,O).cutvalue=d(v,y,w)}function d(v,y,w){var C=v.node(w),O=C.parent,M=!0,A=y.edge(w,O),R=0;return A||(M=!1,A=y.edge(O,w)),R=A.weight,y.nodeEdges(w).forEach(D=>{var F=D.v===w,P=F?D.w:D.v;if(P!==O){var S=F===M,I=y.edge(D).weight;if(R+=S?I:-I,m(v,w,P)){var _=v.edge(w,P).cutvalue;R+=S?-_:_}}}),R}function l(v,y){arguments.length<2&&(y=v.nodes()[0]),u(v,{},1,y)}function u(v,y,w,C,O){var M=w,A=v.node(C);return y[C]=!0,v.neighbors(C).forEach(R=>{Object.hasOwn(y,R)||(w=u(v,y,w,R,C))}),A.low=M,A.lim=w++,O?A.parent=O:delete A.parent,w}function p(v){return v.edges().find(y=>v.edge(y).cutvalue<0)}function h(v,y,w){var C=w.v,O=w.w;y.hasEdge(C,O)||(C=w.w,O=w.v);var M=v.node(C),A=v.node(O),R=M,D=!1;M.lim>A.lim&&(R=A,D=!0);var F=y.edges().filter(P=>D===b(v,v.node(P.v),R)&&D!==b(v,v.node(P.w),R));return F.reduce((P,S)=>t(y,S)<t(y,P)?S:P)}function g(v,y,w,C){var O=w.v,M=w.w;v.removeEdge(O,M),v.setEdge(C.v,C.w,{}),l(v),a(v,y),f(v,y)}function f(v,y){var w=v.nodes().find(O=>!y.node(O).parent),C=s(v,w);C=C.slice(1),C.forEach(O=>{var M=v.node(O).parent,A=y.edge(O,M),R=!1;A||(A=y.edge(M,O),R=!0),y.node(O).rank=y.node(M).rank+(R?A.minlen:-A.minlen)})}function m(v,y,w){return v.hasEdge(y,w)}function b(v,y,w){return w.low<=y.lim&&y.lim<=w.lim}return oa}var aa,Xd;function Ev(){if(Xd)return aa;Xd=1;var e=Ln(),t=e.longestPath,i=Op(),s=kv();aa=r;function r(c){var d=c.graph().ranker;if(d instanceof Function)return d(c);switch(c.graph().ranker){case"network-simplex":a(c);break;case"tight-tree":o(c);break;case"longest-path":n(c);break;case"none":break;default:a(c)}}var n=t;function o(c){t(c),i(c)}function a(c){s(c)}return aa}var la,Jd;function xv(){if(Jd)return la;Jd=1,la=e;function e(s){let r=i(s);s.graph().dummyChains.forEach(n=>{let o=s.node(n),a=o.edgeObj,c=t(s,r,a.v,a.w),d=c.path,l=c.lca,u=0,p=d[u],h=!0;for(;n!==a.w;){if(o=s.node(n),h){for(;(p=d[u])!==l&&s.node(p).maxRank<o.rank;)u++;p===l&&(h=!1)}if(!h){for(;u<d.length-1&&s.node(p=d[u+1]).minRank<=o.rank;)u++;p=d[u]}s.setParent(n,p),n=s.successors(n)[0]}})}function t(s,r,n,o){let a=[],c=[],d=Math.min(r[n].low,r[o].low),l=Math.max(r[n].lim,r[o].lim),u,p;u=n;do u=s.parent(u),a.push(u);while(u&&(r[u].low>d||l>r[u].lim));for(p=u,u=o;(u=s.parent(u))!==p;)c.push(u);return{path:a.concat(c.reverse()),lca:p}}function i(s){let r={},n=0;function o(a){let c=n;s.children(a).forEach(o),r[a]={low:c,lim:n++}}return s.children().forEach(o),r}return la}var ca,Zd;function Tv(){if(Zd)return ca;Zd=1;let e=Je();ca={run:t,cleanup:n};function t(o){let a=e.addDummyNode(o,"root",{},"_root"),c=s(o),d=Object.values(c),l=e.applyWithChunking(Math.max,d)-1,u=2*l+1;o.graph().nestingRoot=a,o.edges().forEach(h=>o.edge(h).minlen*=u);let p=r(o)+1;o.children().forEach(h=>i(o,a,u,p,l,c,h)),o.graph().nodeRankFactor=u}function i(o,a,c,d,l,u,p){let h=o.children(p);if(!h.length){p!==a&&o.setEdge(a,p,{weight:0,minlen:c});return}let g=e.addBorderNode(o,"_bt"),f=e.addBorderNode(o,"_bb"),m=o.node(p);o.setParent(g,p),m.borderTop=g,o.setParent(f,p),m.borderBottom=f,h.forEach(b=>{i(o,a,c,d,l,u,b);let v=o.node(b),y=v.borderTop?v.borderTop:b,w=v.borderBottom?v.borderBottom:b,C=v.borderTop?d:2*d,O=y!==w?1:l-u[p]+1;o.setEdge(g,y,{weight:C,minlen:O,nestingEdge:!0}),o.setEdge(w,f,{weight:C,minlen:O,nestingEdge:!0})}),o.parent(p)||o.setEdge(a,g,{weight:0,minlen:l+u[p]})}function s(o){var a={};function c(d,l){var u=o.children(d);u&&u.length&&u.forEach(p=>c(p,l+1)),a[d]=l}return o.children().forEach(d=>c(d,1)),a}function r(o){return o.edges().reduce((a,c)=>a+o.edge(c).weight,0)}function n(o){var a=o.graph();o.removeNode(a.nestingRoot),delete a.nestingRoot,o.edges().forEach(c=>{var d=o.edge(c);d.nestingEdge&&o.removeEdge(c)})}return ca}var da,Qd;function Cv(){if(Qd)return da;Qd=1;let e=Je();da=t;function t(s){function r(n){let o=s.children(n),a=s.node(n);if(o.length&&o.forEach(r),Object.hasOwn(a,"minRank")){a.borderLeft=[],a.borderRight=[];for(let c=a.minRank,d=a.maxRank+1;c<d;++c)i(s,"borderLeft","_bl",n,a,c),i(s,"borderRight","_br",n,a,c)}}s.children().forEach(r)}function i(s,r,n,o,a,c){let d={width:0,height:0,rank:c,borderType:r},l=a[r][c-1],u=e.addDummyNode(s,"border",d,n);a[r][c]=u,s.setParent(u,o),l&&s.setEdge(l,u,{weight:1})}return da}var ua,eu;function Sv(){if(eu)return ua;eu=1,ua={adjust:e,undo:t};function e(c){let d=c.graph().rankdir.toLowerCase();(d==="lr"||d==="rl")&&i(c)}function t(c){let d=c.graph().rankdir.toLowerCase();(d==="bt"||d==="rl")&&r(c),(d==="lr"||d==="rl")&&(o(c),i(c))}function i(c){c.nodes().forEach(d=>s(c.node(d))),c.edges().forEach(d=>s(c.edge(d)))}function s(c){let d=c.width;c.width=c.height,c.height=d}function r(c){c.nodes().forEach(d=>n(c.node(d))),c.edges().forEach(d=>{let l=c.edge(d);l.points.forEach(n),Object.hasOwn(l,"y")&&n(l)})}function n(c){c.y=-c.y}function o(c){c.nodes().forEach(d=>a(c.node(d))),c.edges().forEach(d=>{let l=c.edge(d);l.points.forEach(a),Object.hasOwn(l,"x")&&a(l)})}function a(c){let d=c.x;c.x=c.y,c.y=d}return ua}var ha,tu;function Ov(){if(tu)return ha;tu=1;let e=Je();ha=t;function t(i){let s={},r=i.nodes().filter(l=>!i.children(l).length),n=r.map(l=>i.node(l).rank),o=e.applyWithChunking(Math.max,n),a=e.range(o+1).map(()=>[]);function c(l){if(s[l])return;s[l]=!0;let u=i.node(l);a[u.rank].push(l),i.successors(l).forEach(c)}return r.sort((l,u)=>i.node(l).rank-i.node(u).rank).forEach(c),a}return ha}var pa,iu;function Av(){if(iu)return pa;iu=1;let e=Je().zipObject;pa=t;function t(s,r){let n=0;for(let o=1;o<r.length;++o)n+=i(s,r[o-1],r[o]);return n}function i(s,r,n){let o=e(n,n.map((p,h)=>h)),a=r.flatMap(p=>s.outEdges(p).map(h=>({pos:o[h.w],weight:s.edge(h).weight})).sort((h,g)=>h.pos-g.pos)),c=1;for(;c<n.length;)c<<=1;let d=2*c-1;c-=1;let l=new Array(d).fill(0),u=0;return a.forEach(p=>{let h=p.pos+c;l[h]+=p.weight;let g=0;for(;h>0;)h%2&&(g+=l[h+1]),h=h-1>>1,l[h]+=p.weight;u+=p.weight*g}),u}return pa}var fa,su;function Iv(){if(su)return fa;su=1,fa=e;function e(t,i=[]){return i.map(s=>{let r=t.inEdges(s);if(r.length){let n=r.reduce((o,a)=>{let c=t.edge(a),d=t.node(a.v);return{sum:o.sum+c.weight*d.order,weight:o.weight+c.weight}},{sum:0,weight:0});return{v:s,barycenter:n.sum/n.weight,weight:n.weight}}else return{v:s}})}return fa}var ma,ru;function Rv(){if(ru)return ma;ru=1;let e=Je();ma=t;function t(r,n){let o={};r.forEach((c,d)=>{let l=o[c.v]={indegree:0,in:[],out:[],vs:[c.v],i:d};c.barycenter!==void 0&&(l.barycenter=c.barycenter,l.weight=c.weight)}),n.edges().forEach(c=>{let d=o[c.v],l=o[c.w];d!==void 0&&l!==void 0&&(l.indegree++,d.out.push(o[c.w]))});let a=Object.values(o).filter(c=>!c.indegree);return i(a)}function i(r){let n=[];function o(c){return d=>{d.merged||(d.barycenter===void 0||c.barycenter===void 0||d.barycenter>=c.barycenter)&&s(c,d)}}function a(c){return d=>{d.in.push(c),--d.indegree===0&&r.push(d)}}for(;r.length;){let c=r.pop();n.push(c),c.in.reverse().forEach(o(c)),c.out.forEach(a(c))}return n.filter(c=>!c.merged).map(c=>e.pick(c,["vs","i","barycenter","weight"]))}function s(r,n){let o=0,a=0;r.weight&&(o+=r.barycenter*r.weight,a+=r.weight),n.weight&&(o+=n.barycenter*n.weight,a+=n.weight),r.vs=n.vs.concat(r.vs),r.barycenter=o/a,r.weight=a,r.i=Math.min(n.i,r.i),n.merged=!0}return ma}var ga,nu;function $v(){if(nu)return ga;nu=1;let e=Je();ga=t;function t(r,n){let o=e.partition(r,g=>Object.hasOwn(g,"barycenter")),a=o.lhs,c=o.rhs.sort((g,f)=>f.i-g.i),d=[],l=0,u=0,p=0;a.sort(s(!!n)),p=i(d,c,p),a.forEach(g=>{p+=g.vs.length,d.push(g.vs),l+=g.barycenter*g.weight,u+=g.weight,p=i(d,c,p)});let h={vs:d.flat(!0)};return u&&(h.barycenter=l/u,h.weight=u),h}function i(r,n,o){let a;for(;n.length&&(a=n[n.length-1]).i<=o;)n.pop(),r.push(a.vs),o++;return o}function s(r){return(n,o)=>n.barycenter<o.barycenter?-1:n.barycenter>o.barycenter?1:r?o.i-n.i:n.i-o.i}return ga}var ba,ou;function Dv(){if(ou)return ba;ou=1;let e=Iv(),t=Rv(),i=$v();ba=s;function s(o,a,c,d){let l=o.children(a),u=o.node(a),p=u?u.borderLeft:void 0,h=u?u.borderRight:void 0,g={};p&&(l=l.filter(v=>v!==p&&v!==h));let f=e(o,l);f.forEach(v=>{if(o.children(v.v).length){let y=s(o,v.v,c,d);g[v.v]=y,Object.hasOwn(y,"barycenter")&&n(v,y)}});let m=t(f,c);r(m,g);let b=i(m,d);if(p&&(b.vs=[p,b.vs,h].flat(!0),o.predecessors(p).length)){let v=o.node(o.predecessors(p)[0]),y=o.node(o.predecessors(h)[0]);Object.hasOwn(b,"barycenter")||(b.barycenter=0,b.weight=0),b.barycenter=(b.barycenter*b.weight+v.order+y.order)/(b.weight+2),b.weight+=2}return b}function r(o,a){o.forEach(c=>{c.vs=c.vs.flatMap(d=>a[d]?a[d].vs:d)})}function n(o,a){o.barycenter!==void 0?(o.barycenter=(o.barycenter*o.weight+a.barycenter*a.weight)/(o.weight+a.weight),o.weight+=a.weight):(o.barycenter=a.barycenter,o.weight=a.weight)}return ba}var va,au;function Nv(){if(au)return va;au=1;let e=ri().Graph,t=Je();va=i;function i(r,n,o,a){a||(a=r.nodes());let c=s(r),d=new e({compound:!0}).setGraph({root:c}).setDefaultNodeLabel(l=>r.node(l));return a.forEach(l=>{let u=r.node(l),p=r.parent(l);(u.rank===n||u.minRank<=n&&n<=u.maxRank)&&(d.setNode(l),d.setParent(l,p||c),r[o](l).forEach(h=>{let g=h.v===l?h.w:h.v,f=d.edge(g,l),m=f!==void 0?f.weight:0;d.setEdge(g,l,{weight:r.edge(h).weight+m})}),Object.hasOwn(u,"minRank")&&d.setNode(l,{borderLeft:u.borderLeft[n],borderRight:u.borderRight[n]}))}),d}function s(r){for(var n;r.hasNode(n=t.uniqueId("_root")););return n}return va}var ya,lu;function Lv(){if(lu)return ya;lu=1,ya=e;function e(t,i,s){let r={},n;s.forEach(o=>{let a=t.parent(o),c,d;for(;a;){if(c=t.parent(a),c?(d=r[c],r[c]=a):(d=n,n=a),d&&d!==a){i.setEdge(d,a);return}a=c}})}return ya}var wa,cu;function Pv(){if(cu)return wa;cu=1;let e=Ov(),t=Av(),i=Dv(),s=Nv(),r=Lv(),n=ri().Graph,o=Je();wa=a;function a(u,p){if(p&&typeof p.customOrder=="function"){p.customOrder(u,a);return}let h=o.maxRank(u),g=c(u,o.range(1,h+1),"inEdges"),f=c(u,o.range(h-1,-1,-1),"outEdges"),m=e(u);if(l(u,m),p&&p.disableOptimalOrderHeuristic)return;let b=Number.POSITIVE_INFINITY,v;for(let y=0,w=0;w<4;++y,++w){d(y%2?g:f,y%4>=2),m=o.buildLayerMatrix(u);let C=t(u,m);C<b&&(w=0,v=Object.assign({},m),b=C)}l(u,v)}function c(u,p,h){const g=new Map,f=(m,b)=>{g.has(m)||g.set(m,[]),g.get(m).push(b)};for(const m of u.nodes()){const b=u.node(m);if(typeof b.rank=="number"&&f(b.rank,m),typeof b.minRank=="number"&&typeof b.maxRank=="number")for(let v=b.minRank;v<=b.maxRank;v++)v!==b.rank&&f(v,m)}return p.map(function(m){return s(u,m,h,g.get(m)||[])})}function d(u,p){let h=new n;u.forEach(function(g){let f=g.graph().root,m=i(g,f,h,p);m.vs.forEach((b,v)=>g.node(b).order=v),r(g,h,m.vs)})}function l(u,p){Object.values(p).forEach(h=>h.forEach((g,f)=>u.node(g).order=f))}return wa}var _a,du;function Mv(){if(du)return _a;du=1;let e=ri().Graph,t=Je();_a={positionX:h,findType1Conflicts:i,findType2Conflicts:s,addConflict:n,hasConflict:o,verticalAlignment:a,horizontalCompaction:c,alignCoordinates:u,findSmallestWidthAlignment:l,balance:p};function i(m,b){let v={};function y(w,C){let O=0,M=0,A=w.length,R=C[C.length-1];return C.forEach((D,F)=>{let P=r(m,D),S=P?m.node(P).order:A;(P||D===R)&&(C.slice(M,F+1).forEach(I=>{m.predecessors(I).forEach(_=>{let $=m.node(_),Y=$.order;(Y<O||S<Y)&&!($.dummy&&m.node(I).dummy)&&n(v,_,I)})}),M=F+1,O=S)}),C}return b.length&&b.reduce(y),v}function s(m,b){let v={};function y(C,O,M,A,R){let D;t.range(O,M).forEach(F=>{D=C[F],m.node(D).dummy&&m.predecessors(D).forEach(P=>{let S=m.node(P);S.dummy&&(S.order<A||S.order>R)&&n(v,P,D)})})}function w(C,O){let M=-1,A,R=0;return O.forEach((D,F)=>{if(m.node(D).dummy==="border"){let P=m.predecessors(D);P.length&&(A=m.node(P[0]).order,y(O,R,F,M,A),R=F,M=A)}y(O,R,O.length,A,C.length)}),O}return b.length&&b.reduce(w),v}function r(m,b){if(m.node(b).dummy)return m.predecessors(b).find(v=>m.node(v).dummy)}function n(m,b,v){if(b>v){let w=b;b=v,v=w}let y=m[b];y||(m[b]=y={}),y[v]=!0}function o(m,b,v){if(b>v){let y=b;b=v,v=y}return!!m[b]&&Object.hasOwn(m[b],v)}function a(m,b,v,y){let w={},C={},O={};return b.forEach(M=>{M.forEach((A,R)=>{w[A]=A,C[A]=A,O[A]=R})}),b.forEach(M=>{let A=-1;M.forEach(R=>{let D=y(R);if(D.length){D=D.sort((P,S)=>O[P]-O[S]);let F=(D.length-1)/2;for(let P=Math.floor(F),S=Math.ceil(F);P<=S;++P){let I=D[P];C[R]===R&&A<O[I]&&!o(v,R,I)&&(C[I]=R,C[R]=w[R]=w[I],A=O[I])}}})}),{root:w,align:C}}function c(m,b,v,y,w){let C={},O=d(m,b,v,w),M=w?"borderLeft":"borderRight";function A(F,P){let S=O.nodes(),I=S.pop(),_={};for(;I;)_[I]?F(I):(_[I]=!0,S.push(I),S=S.concat(P(I))),I=S.pop()}function R(F){C[F]=O.inEdges(F).reduce((P,S)=>Math.max(P,C[S.v]+O.edge(S)),0)}function D(F){let P=O.outEdges(F).reduce((I,_)=>Math.min(I,C[_.w]-O.edge(_)),Number.POSITIVE_INFINITY),S=m.node(F);P!==Number.POSITIVE_INFINITY&&S.borderType!==M&&(C[F]=Math.max(C[F],P))}return A(R,O.predecessors.bind(O)),A(D,O.successors.bind(O)),Object.keys(y).forEach(F=>C[F]=C[v[F]]),C}function d(m,b,v,y){let w=new e,C=m.graph(),O=g(C.nodesep,C.edgesep,y);return b.forEach(M=>{let A;M.forEach(R=>{let D=v[R];if(w.setNode(D),A){var F=v[A],P=w.edge(F,D);w.setEdge(F,D,Math.max(O(m,R,A),P||0))}A=R})}),w}function l(m,b){return Object.values(b).reduce((v,y)=>{let w=Number.NEGATIVE_INFINITY,C=Number.POSITIVE_INFINITY;Object.entries(y).forEach(([M,A])=>{let R=f(m,M)/2;w=Math.max(A+R,w),C=Math.min(A-R,C)});const O=w-C;return O<v[0]&&(v=[O,y]),v},[Number.POSITIVE_INFINITY,null])[1]}function u(m,b){let v=Object.values(b),y=t.applyWithChunking(Math.min,v),w=t.applyWithChunking(Math.max,v);["u","d"].forEach(C=>{["l","r"].forEach(O=>{let M=C+O,A=m[M];if(A===b)return;let R=Object.values(A),D=y-t.applyWithChunking(Math.min,R);O!=="l"&&(D=w-t.applyWithChunking(Math.max,R)),D&&(m[M]=t.mapValues(A,F=>F+D))})})}function p(m,b){return t.mapValues(m.ul,(v,y)=>{if(b)return m[b.toLowerCase()][y];{let w=Object.values(m).map(C=>C[y]).sort((C,O)=>C-O);return(w[1]+w[2])/2}})}function h(m){let b=t.buildLayerMatrix(m),v=Object.assign(i(m,b),s(m,b)),y={},w;["u","d"].forEach(O=>{w=O==="u"?b:Object.values(b).reverse(),["l","r"].forEach(M=>{M==="r"&&(w=w.map(F=>Object.values(F).reverse()));let A=(O==="u"?m.predecessors:m.successors).bind(m),R=a(m,w,v,A),D=c(m,w,R.root,R.align,M==="r");M==="r"&&(D=t.mapValues(D,F=>-F)),y[O+M]=D})});let C=l(m,y);return u(y,C),p(y,m.graph().align)}function g(m,b,v){return(y,w,C)=>{let O=y.node(w),M=y.node(C),A=0,R;if(A+=O.width/2,Object.hasOwn(O,"labelpos"))switch(O.labelpos.toLowerCase()){case"l":R=-O.width/2;break;case"r":R=O.width/2;break}if(R&&(A+=v?R:-R),R=0,A+=(O.dummy?b:m)/2,A+=(M.dummy?b:m)/2,A+=M.width/2,Object.hasOwn(M,"labelpos"))switch(M.labelpos.toLowerCase()){case"l":R=M.width/2;break;case"r":R=-M.width/2;break}return R&&(A+=v?R:-R),R=0,A}}function f(m,b){return m.node(b).width}return _a}var ka,uu;function Fv(){if(uu)return ka;uu=1;let e=Je(),t=Mv().positionX;ka=i;function i(r){r=e.asNonCompoundGraph(r),s(r),Object.entries(t(r)).forEach(([n,o])=>r.node(n).x=o)}function s(r){let n=e.buildLayerMatrix(r),o=r.graph().ranksep,a=0;n.forEach(c=>{const d=c.reduce((l,u)=>{const p=r.node(u).height;return l>p?l:p},0);c.forEach(l=>r.node(l).y=a+d/2),a+=d+o})}return ka}var Ea,hu;function zv(){if(hu)return Ea;hu=1;let e=wv(),t=_v(),i=Ev(),s=Je().normalizeRanks,r=xv(),n=Je().removeEmptyRanks,o=Tv(),a=Cv(),c=Sv(),d=Pv(),l=Fv(),u=Je(),p=ri().Graph;Ea=h;function h(N,z){let H=z&&z.debugTiming?u.time:u.notime;H("layout",()=>{let K=H("  buildLayoutGraph",()=>A(N));H("  runLayout",()=>g(K,H,z)),H("  updateInputGraph",()=>f(N,K))})}function g(N,z,H){z("    makeSpaceForEdgeLabels",()=>R(N)),z("    removeSelfEdges",()=>ie(N)),z("    acyclic",()=>e.run(N)),z("    nestingGraph.run",()=>o.run(N)),z("    rank",()=>i(u.asNonCompoundGraph(N))),z("    injectEdgeLabelProxies",()=>D(N)),z("    removeEmptyRanks",()=>n(N)),z("    nestingGraph.cleanup",()=>o.cleanup(N)),z("    normalizeRanks",()=>s(N)),z("    assignRankMinMax",()=>F(N)),z("    removeEdgeLabelProxies",()=>P(N)),z("    normalize.run",()=>t.run(N)),z("    parentDummyChains",()=>r(N)),z("    addBorderSegments",()=>a(N)),z("    order",()=>d(N,H)),z("    insertSelfEdges",()=>oe(N)),z("    adjustCoordinateSystem",()=>c.adjust(N)),z("    position",()=>l(N)),z("    positionSelfEdges",()=>_e(N)),z("    removeBorderNodes",()=>Y(N)),z("    normalize.undo",()=>t.undo(N)),z("    fixupEdgeLabelCoords",()=>_(N)),z("    undoCoordinateSystem",()=>c.undo(N)),z("    translateGraph",()=>S(N)),z("    assignNodeIntersects",()=>I(N)),z("    reversePoints",()=>$(N)),z("    acyclic.undo",()=>e.undo(N))}function f(N,z){N.nodes().forEach(H=>{let K=N.node(H),ce=z.node(H);K&&(K.x=ce.x,K.y=ce.y,K.rank=ce.rank,z.children(H).length&&(K.width=ce.width,K.height=ce.height))}),N.edges().forEach(H=>{let K=N.edge(H),ce=z.edge(H);K.points=ce.points,Object.hasOwn(ce,"x")&&(K.x=ce.x,K.y=ce.y)}),N.graph().width=z.graph().width,N.graph().height=z.graph().height}let m=["nodesep","edgesep","ranksep","marginx","marginy"],b={ranksep:50,edgesep:20,nodesep:50,rankdir:"tb"},v=["acyclicer","ranker","rankdir","align"],y=["width","height","rank"],w={width:0,height:0},C=["minlen","weight","width","height","labeloffset"],O={minlen:1,weight:1,width:0,height:0,labeloffset:10,labelpos:"r"},M=["labelpos"];function A(N){let z=new p({multigraph:!0,compound:!0}),H=de(N.graph());return z.setGraph(Object.assign({},b,ae(H,m),u.pick(H,v))),N.nodes().forEach(K=>{let ce=de(N.node(K));const X=ae(ce,y);Object.keys(w).forEach(Se=>{X[Se]===void 0&&(X[Se]=w[Se])}),z.setNode(K,X),z.setParent(K,N.parent(K))}),N.edges().forEach(K=>{let ce=de(N.edge(K));z.setEdge(K,Object.assign({},O,ae(ce,C),u.pick(ce,M)))}),z}function R(N){let z=N.graph();z.ranksep/=2,N.edges().forEach(H=>{let K=N.edge(H);K.minlen*=2,K.labelpos.toLowerCase()!=="c"&&(z.rankdir==="TB"||z.rankdir==="BT"?K.width+=K.labeloffset:K.height+=K.labeloffset)})}function D(N){N.edges().forEach(z=>{let H=N.edge(z);if(H.width&&H.height){let K=N.node(z.v),X={rank:(N.node(z.w).rank-K.rank)/2+K.rank,e:z};u.addDummyNode(N,"edge-proxy",X,"_ep")}})}function F(N){let z=0;N.nodes().forEach(H=>{let K=N.node(H);K.borderTop&&(K.minRank=N.node(K.borderTop).rank,K.maxRank=N.node(K.borderBottom).rank,z=Math.max(z,K.maxRank))}),N.graph().maxRank=z}function P(N){N.nodes().forEach(z=>{let H=N.node(z);H.dummy==="edge-proxy"&&(N.edge(H.e).labelRank=H.rank,N.removeNode(z))})}function S(N){let z=Number.POSITIVE_INFINITY,H=0,K=Number.POSITIVE_INFINITY,ce=0,X=N.graph(),Se=X.marginx||0,Qe=X.marginy||0;function $e(lt){let ge=lt.x,pi=lt.y,Be=lt.width,fi=lt.height;z=Math.min(z,ge-Be/2),H=Math.max(H,ge+Be/2),K=Math.min(K,pi-fi/2),ce=Math.max(ce,pi+fi/2)}N.nodes().forEach(lt=>$e(N.node(lt))),N.edges().forEach(lt=>{let ge=N.edge(lt);Object.hasOwn(ge,"x")&&$e(ge)}),z-=Se,K-=Qe,N.nodes().forEach(lt=>{let ge=N.node(lt);ge.x-=z,ge.y-=K}),N.edges().forEach(lt=>{let ge=N.edge(lt);ge.points.forEach(pi=>{pi.x-=z,pi.y-=K}),Object.hasOwn(ge,"x")&&(ge.x-=z),Object.hasOwn(ge,"y")&&(ge.y-=K)}),X.width=H-z+Se,X.height=ce-K+Qe}function I(N){N.edges().forEach(z=>{let H=N.edge(z),K=N.node(z.v),ce=N.node(z.w),X,Se;H.points?(X=H.points[0],Se=H.points[H.points.length-1]):(H.points=[],X=ce,Se=K),H.points.unshift(u.intersectRect(K,X)),H.points.push(u.intersectRect(ce,Se))})}function _(N){N.edges().forEach(z=>{let H=N.edge(z);if(Object.hasOwn(H,"x"))switch((H.labelpos==="l"||H.labelpos==="r")&&(H.width-=H.labeloffset),H.labelpos){case"l":H.x-=H.width/2+H.labeloffset;break;case"r":H.x+=H.width/2+H.labeloffset;break}})}function $(N){N.edges().forEach(z=>{let H=N.edge(z);H.reversed&&H.points.reverse()})}function Y(N){N.nodes().forEach(z=>{if(N.children(z).length){let H=N.node(z),K=N.node(H.borderTop),ce=N.node(H.borderBottom),X=N.node(H.borderLeft[H.borderLeft.length-1]),Se=N.node(H.borderRight[H.borderRight.length-1]);H.width=Math.abs(Se.x-X.x),H.height=Math.abs(ce.y-K.y),H.x=X.x+H.width/2,H.y=K.y+H.height/2}}),N.nodes().forEach(z=>{N.node(z).dummy==="border"&&N.removeNode(z)})}function ie(N){N.edges().forEach(z=>{if(z.v===z.w){var H=N.node(z.v);H.selfEdges||(H.selfEdges=[]),H.selfEdges.push({e:z,label:N.edge(z)}),N.removeEdge(z)}})}function oe(N){var z=u.buildLayerMatrix(N);z.forEach(H=>{var K=0;H.forEach((ce,X)=>{var Se=N.node(ce);Se.order=X+K,(Se.selfEdges||[]).forEach(Qe=>{u.addDummyNode(N,"selfedge",{width:Qe.label.width,height:Qe.label.height,rank:Se.rank,order:X+ ++K,e:Qe.e,label:Qe.label},"_se")}),delete Se.selfEdges})})}function _e(N){N.nodes().forEach(z=>{var H=N.node(z);if(H.dummy==="selfedge"){var K=N.node(H.e.v),ce=K.x+K.width/2,X=K.y,Se=H.x-ce,Qe=K.height/2;N.setEdge(H.e,H.label),N.removeNode(z),H.label.points=[{x:ce+2*Se/3,y:X-Qe},{x:ce+5*Se/6,y:X-Qe},{x:ce+Se,y:X},{x:ce+5*Se/6,y:X+Qe},{x:ce+2*Se/3,y:X+Qe}],H.label.x=H.x,H.label.y=H.y}})}function ae(N,z){return u.mapValues(u.pick(N,z),Number)}function de(N){var z={};return N&&Object.entries(N).forEach(([H,K])=>{typeof H=="string"&&(H=H.toLowerCase()),z[H]=K}),z}return Ea}var xa,pu;function Bv(){if(pu)return xa;pu=1;let e=Je(),t=ri().Graph;xa={debugOrdering:i};function i(s){let r=e.buildLayerMatrix(s),n=new t({compound:!0,multigraph:!0}).setGraph({});return s.nodes().forEach(o=>{n.setNode(o,{label:o}),n.setParent(o,"layer"+s.node(o).rank)}),s.edges().forEach(o=>n.setEdge(o.v,o.w,{},o.name)),r.forEach((o,a)=>{let c="layer"+a;n.setNode(c,{rank:"same"}),o.reduce((d,l)=>(n.setEdge(d,l,{style:"invis"}),l))}),n}return xa}var Ta,fu;function Uv(){return fu||(fu=1,Ta="1.1.8"),Ta}var Ca,mu;function qv(){return mu||(mu=1,Ca={graphlib:ri(),layout:zv(),debug:Bv(),util:{time:Je().time,notime:Je().notime},version:Uv()}),Ca}var Hv=qv();const gu=kp(Hv);var Vv=Object.defineProperty,jv=Object.getOwnPropertyDescriptor,Ii=(e,t,i,s)=>{for(var r=s>1?void 0:s?jv(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&Vv(t,i,r),r};function Gv(e,t){return`M ${e.x} ${e.y} L ${t.x} ${t.y}`}const $r=180,Wv=8,bu=.35;let Kt=class extends ye{constructor(){super(...arguments),this.nodes=[],this.edges=[],this.panX=0,this.panY=0,this.scale=1,this.containerWidth=800,this.containerHeight=600,this.isDragging=!1,this.wasDragging=!1,this.dragStartGraphX=0,this.dragStartGraphY=0,this.dragStartPanX=0,this.dragStartPanY=0,this.cachedNodeMap=new Map,this.lastNodesRef=[],this.onMouseMove=e=>{if(!this.isDragging)return;e.preventDefault();const t=this.mouseToGraph(e);if(!t)return;const i=t.gx-this.dragStartGraphX,s=t.gy-this.dragStartGraphY,r=this.dragStartPanX+i*bu,n=this.dragStartPanY+s*bu;this.dispatchEvent(new CustomEvent("minimap-pan",{detail:{panX:r,panY:n},bubbles:!0,composed:!0}))},this.onMouseUp=()=>{this.isDragging&&(this.wasDragging=!0),this.isDragging=!1}}connectedCallback(){super.connectedCallback(),window.addEventListener("mousemove",this.onMouseMove),window.addEventListener("mouseup",this.onMouseUp)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("mousemove",this.onMouseMove),window.removeEventListener("mouseup",this.onMouseUp)}willUpdate(e){super.willUpdate(e),this.nodes!==this.lastNodesRef&&(this.lastNodesRef=this.nodes,this.cachedNodeMap=new Map(this.nodes.map(t=>[t.id,t])))}getGraphBounds(){if(this.nodes.length===0)return{minX:0,minY:0,maxX:100,maxY:100};let e=1/0,t=-1/0,i=1/0,s=-1/0;for(const r of this.nodes){const n=r.x-r.width/2,o=r.x+r.width/2,a=r.y-r.height/2,c=r.y+r.height/2;n<e&&(e=n),o>t&&(t=o),a<i&&(i=a),c>s&&(s=c)}return{minX:e,minY:i,maxX:t,maxY:s}}mouseToGraph(e){const t=this.renderRoot.querySelector("svg");if(!t)return null;const i=t.getBoundingClientRect(),s=e.clientX-i.left,r=e.clientY-i.top,n=t.viewBox.baseVal;if(!n||n.width===0||n.height===0)return null;const o=n.x+s/i.width*n.width,a=n.y+r/i.height*n.height;return{gx:o,gy:a}}onFrameMouseDown(e){if(e.button!==0)return;e.preventDefault(),e.stopPropagation();const t=this.mouseToGraph(e);t&&(this.isDragging=!0,this.dragStartGraphX=t.gx,this.dragStartGraphY=t.gy,this.dragStartPanX=this.panX,this.dragStartPanY=this.panY)}onWheel(e){e.preventDefault(),this.dispatchEvent(new CustomEvent("minimap-wheel",{detail:{deltaY:e.deltaY,clientX:e.clientX,clientY:e.clientY},bubbles:!0,composed:!0}))}onMinimapClick(e){var a;if(this.wasDragging){this.wasDragging=!1;return}if((a=e.target.classList)!=null&&a.contains("viewport-frame"))return;e.preventDefault(),e.stopPropagation();const i=this.mouseToGraph(e);if(!i)return;const s=this.containerWidth/this.scale,r=this.containerHeight/this.scale,n=i.gx-s/2,o=i.gy-r/2;this.dispatchEvent(new CustomEvent("minimap-pan",{detail:{panX:n,panY:o},bubbles:!0,composed:!0}))}render(){if(this.nodes.length===0)return T``;const e=this.getGraphBounds(),t=40,i=this.panX,s=this.panY,r=this.containerWidth/this.scale,n=this.containerHeight/this.scale,o=Math.min(e.minX-t,i),a=Math.min(e.minY-t,s),c=Math.max(e.maxX+t,i+r),d=Math.max(e.maxY+t,s+n),l=c-o,u=d-a,p=$r-2*Wv,h=Math.min(p/l,p/u),g=$r/h,f=$r/h,m=o+l/2-g/2,b=a+u/2-f/2,v=this.cachedNodeMap,y=this.edgePathFn??Gv;return T`
      <div class="minimap" @click=${this.onMinimapClick} @wheel=${this.onWheel}>
        <svg viewBox="${m} ${b} ${g} ${f}">
          <!-- Edges -->
          <g class="minimap-edges">
            ${this.edges.map(w=>{const C=v.get(w.from),O=v.get(w.to);return!C||!O?null:Ji`<path d="${y(C,O)}" class="minimap-edge" />`})}
          </g>
          <!-- Nodes -->
          <g class="minimap-nodes">
            ${this.nodes.map(w=>Ji`<rect
                  class="minimap-node"
                  x="${w.x-w.width/2}"
                  y="${w.y-w.height/2}"
                  width="${w.width}"
                  height="${w.height}"
                  rx="3"
                />`)}
          </g>
          <!-- Viewport frame -->
          <rect
            class="viewport-frame ${this.isDragging?"dragging":""}"
            x="${i}"
            y="${s}"
            width="${r}"
            height="${n}"
            rx="2"
            @mousedown=${this.onFrameMouseDown}
          />
        </svg>
      </div>
    `}};Kt.styles=ee`
    :host {
      position: absolute;
      bottom: 12px;
      left: 12px;
      z-index: 10;
      pointer-events: auto;
    }
    .minimap {
      width: ${$r}px;
      height: ${$r}px;
      background: var(--sl-color-neutral-50, #f8fafc);
      border: 1px solid var(--sl-color-neutral-300, #cbd5e1);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      cursor: pointer;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .minimap-node {
      fill: var(--sl-color-neutral-300, #cbd5e1);
      stroke: var(--sl-color-neutral-400, #94a3b8);
      stroke-width: 0.5;
      rx: 3;
    }
    .minimap-edge {
      stroke: var(--sl-color-neutral-300, #cbd5e1);
      stroke-width: 0.5;
      fill: none;
    }
    .viewport-frame {
      fill: rgba(99, 102, 241, 0.08);
      stroke: var(--sl-color-primary-500, #6366f1);
      stroke-width: 1.5;
      cursor: grab;
    }
    .viewport-frame.dragging {
      cursor: grabbing;
      fill: rgba(99, 102, 241, 0.15);
    }
  `;Ii([k({attribute:!1})],Kt.prototype,"nodes",2);Ii([k({attribute:!1})],Kt.prototype,"edges",2);Ii([k({type:Number})],Kt.prototype,"panX",2);Ii([k({type:Number})],Kt.prototype,"panY",2);Ii([k({type:Number})],Kt.prototype,"scale",2);Ii([k({type:Number})],Kt.prototype,"containerWidth",2);Ii([k({type:Number})],Kt.prototype,"containerHeight",2);Ii([k({attribute:!1})],Kt.prototype,"edgePathFn",2);Ii([U()],Kt.prototype,"isDragging",2);Kt=Ii([Oe("ft-minimap")],Kt);var Yv=Object.defineProperty,Kv=Object.getOwnPropertyDescriptor,gt=(e,t,i,s)=>{for(var r=s>1?void 0:s?Kv(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&Yv(t,i,r),r};const vu=220,Xv=80,Jv=500,Zv=3;function Qv(e){return e.length===0?"":e.map((t,i)=>`${i===0?"M":"L"} ${t.x} ${t.y}`).join(" ")}function hn(e,t){const i=new Set,s=[e];for(;s.length>0;){const r=s.shift();if(!i.has(r)){i.add(r);for(const n of t.getChildren(r))s.push(n.id)}}return i}let Ve=class extends ye{constructor(){super(...arguments),this.selectedTaskId=null,this.readOnly=!1,this.layoutOrientation="LR",this.focusRootId=null,this.isolateMode=!1,this.maxDepth=-1,this.panX=0,this.panY=0,this.scale=1,this.draggedTaskId=null,this.dropTargetId=null,this.isPanning=!1,this.expandedNodes=new Set,this.expandedInitialized=!1,this._userSetDepth=!1,this._dragDescendants=null,this.containerWidth=800,this.containerHeight=600,this.panStartX=0,this.panStartY=0,this.panStartViewX=0,this.panStartViewY=0,this.layoutNodes=[],this.layoutEdges=[],this.lastStructureKey="",this.needsCenter=!0,this.animationFrameId=null,this.handleMouseMove=e=>{if(!this.isPanning)return;const t=(e.clientX-this.panStartX)/this.scale,i=(e.clientY-this.panStartY)/this.scale;this.panX=this.panStartViewX-t,this.panY=this.panStartViewY-i},this.handleMouseUp=()=>{this.isPanning=!1}}cancelPanAnimation(){this.animationFrameId!==null&&(cancelAnimationFrame(this.animationFrameId),this.animationFrameId=null)}connectedCallback(){super.connectedCallback(),this.storeCtrl=new Is(this,this.store),window.addEventListener("mousemove",this.handleMouseMove),window.addEventListener("mouseup",this.handleMouseUp)}disconnectedCallback(){var e;super.disconnectedCallback(),window.removeEventListener("mousemove",this.handleMouseMove),window.removeEventListener("mouseup",this.handleMouseUp),(e=this.resizeObserver)==null||e.disconnect(),this.cancelPanAnimation()}firstUpdated(){const e=this.renderRoot.querySelector(".canvas-container");if(e){const t=e.getBoundingClientRect();t.width>0&&(this.containerWidth=t.width),t.height>0&&(this.containerHeight=t.height),this.resizeObserver=new ResizeObserver(i=>{for(const s of i){const r=s.contentRect.width,n=s.contentRect.height;r>0&&(this.containerWidth=r),n>0&&(this.containerHeight=n),this.requestUpdate()}}),this.resizeObserver.observe(e)}this.layoutNodes.length>0&&this.needsCenter&&(this.centerGraph(),this.needsCenter=!1)}willUpdate(e){super.willUpdate(e),!this._userSetDepth&&this.maxDepth===-1&&this.store.taskCount>Jv&&(this.maxDepth=Zv)}updated(e){if(e.has("selectedTaskId")&&this.selectedTaskId)this.centerOnNode(this.selectedTaskId),this.needsCenter=!1;else if(this.needsCenter&&this.layoutNodes.length>0){const t=this.renderRoot.querySelector(".canvas-container");if(t){const i=t.getBoundingClientRect();i.width>0&&(this.containerWidth=i.width,this.containerHeight=i.height,this.centerGraph(),this.needsCenter=!1)}}}centerOnNode(e){const t=this.layoutNodes.find(a=>a.id===e);if(!t)return;const i=Math.min(3,Math.max(.3,Ve.TARGET_NODE_VIEWPORT_FRACTION*this.containerWidth/vu)),s=this.containerWidth/i,r=this.containerHeight/i,n=t.x-s/2,o=t.y-r/2;this.animatePanZoomTo(n,o,i,t.x,t.y)}static easeInOut(e){return e<.5?2*e*e:1-Math.pow(-2*e+2,2)/2}animatePanZoomTo(e,t,i,s,r){this.cancelPanAnimation();const n=this.panX,o=this.panY,a=this.scale,c=n+this.containerWidth/a/2,d=o+this.containerHeight/a/2,l=Ve.PAN_DURATION_MS;let u=null;const p=h=>{u===null&&(u=h);const g=h-u,f=Math.min(g/l,1),m=Ve.easeInOut(f),b=a+(i-a)*m,v=c+(s-c)*m,y=d+(r-d)*m,w=this.containerWidth/b,C=this.containerHeight/b;this.scale=b,this.panX=v-w/2,this.panY=y-C/2,f<1?this.animationFrameId=requestAnimationFrame(p):(this.scale=i,this.panX=e,this.panY=t,this.animationFrameId=null)};this.animationFrameId=requestAnimationFrame(p)}getVisibleTasks(){this.initExpandedNodes();const e=this.isolateMode&&this.selectedTaskId?this.selectedTaskId:this.focusRootId;let t;if(e){const i=hn(e,this.store);t=this.store.allTasks.filter(s=>i.has(s.id))}else t=[...this.store.allTasks];if(this.maxDepth>=0){const i=new Map,s=(n,o)=>{i.set(n,o);for(const a of this.store.getChildren(n))s(a.id,o+1)},r=e?[this.store.getTask(e)].filter(Boolean):this.store.roots;for(const n of r)s(n.id,0);t=t.filter(n=>(i.get(n.id)??0)<=this.maxDepth)}return t=t.filter(i=>!this.hasCollapsedAncestor(i)),t}structureKey(e){const t=[...this.expandedNodes].sort().join(","),i=this.isolateMode?`iso:${this.selectedTaskId??""}`:"";return e.map(s=>`${s.id}:${s.parentTaskId??""}`).sort().join("|")+"||"+t+"||"+i+"||"+this.layoutOrientation}runLayout(){const e=this.getVisibleTasks(),t=this.structureKey(e);if(t===this.lastStructureKey&&this.layoutNodes.length>0){const r=new Map(e.map(n=>[n.id,n]));for(const n of this.layoutNodes){const o=r.get(n.id);o&&(n.task=o)}return}this.lastStructureKey=t,this.needsCenter=!0;const i=new gu.graphlib.Graph({directed:!0,multigraph:!0});i.setGraph({rankdir:this.layoutOrientation,nodesep:40,ranksep:60}),i.setDefaultEdgeLabel(()=>({}));const s=new Set(e.map(r=>r.id));for(const r of e)i.setNode(r.id,{width:vu,height:Xv,task:r});for(const r of e)r.parentTaskId&&s.has(r.parentTaskId)&&i.setEdge(r.parentTaskId,r.id,{type:"hierarchy"},"h");gu.layout(i),this.layoutNodes=i.nodes().map(r=>{const n=i.node(r);return{id:r,x:n.x,y:n.y,width:n.width,height:n.height,task:n.task}}),this.layoutEdges=[];for(const r of i.edges()){const o=i.edge(r).points||[];this.layoutEdges.push({from:r.v,to:r.w,points:o,type:"hierarchy"})}}centerGraph(){if(this.cancelPanAnimation(),this.layoutNodes.length===0)return;const e=40;let t=1/0,i=-1/0,s=1/0,r=-1/0;for(const h of this.layoutNodes){const g=h.x-h.width/2,f=h.x+h.width/2,m=h.y-h.height/2,b=h.y+h.height/2;g<t&&(t=g),f>i&&(i=f),m<s&&(s=m),b>r&&(r=b)}t-=e,s-=e,i+=e,r+=e;const n=i-t,o=r-s,a=this.containerWidth/n,c=this.containerHeight/o;this.scale=Math.min(a,c,2),this.scale=Math.max(.3,this.scale);const d=this.containerWidth/this.scale,l=this.containerHeight/this.scale,u=(t+i)/2,p=(s+r)/2;this.panX=u-d/2,this.panY=p-l/2}onMouseDown(e){if(e.button!==0)return;const t=e.target;t.closest("ft-tree-node")||t.closest("foreignObject")||(this.cancelPanAnimation(),this.isPanning=!0,this.panStartX=e.clientX,this.panStartY=e.clientY,this.panStartViewX=this.panX,this.panStartViewY=this.panY,e.preventDefault())}onWheel(e){e.preventDefault(),this.cancelPanAnimation();const t=e.deltaY>0?.9:1.1,i=Math.min(3,Math.max(.3,this.scale*t)),s=e.currentTarget.getBoundingClientRect(),r=e.clientX-s.left,n=e.clientY-s.top,o=this.panX+r/this.scale,a=this.panY+n/this.scale;this.panX=o-r/i,this.panY=a-n/i,this.scale=i}onNodeClick(e){this.dispatchEvent(new CustomEvent("task-select",{detail:{taskId:e},bubbles:!0,composed:!0}))}onNodeDblClick(e){this.focusRootId=e,this.lastStructureKey=""}onFocusChange(e){this.focusRootId=e.detail.focusRootId,this.lastStructureKey=""}onLevelChange(e){this._userSetDepth=!0,this.maxDepth=e.detail.maxDepth,this.lastStructureKey=""}onLayoutOrientationToggle(e){this.dispatchEvent(new CustomEvent("layout-orientation-toggle",{detail:e.detail,bubbles:!0,composed:!0}))}initExpandedNodes(){if(!this.expandedInitialized){this.expandedInitialized=!0;for(const e of this.store.allTasks)this.expandedNodes.add(e.id)}}toggleExpand(e){const t=new Set(this.expandedNodes);t.has(e)?t.delete(e):t.add(e),this.expandedNodes=t,this.lastStructureKey=""}onToggleExpand(e){this.toggleExpand(e.detail.taskId)}hasCollapsedAncestor(e){let t=e.parentTaskId?this.store.getTask(e.parentTaskId):void 0;for(;t;){if(!this.expandedNodes.has(t.id))return!0;t=t.parentTaskId?this.store.getTask(t.parentTaskId):void 0}return!1}get isReparentDisabled(){var e;return this.readOnly||((e=this.capabilities)==null?void 0:e.canChangeParent)===!1}onDragStartCapture(e){var i,s,r;if(this.isReparentDisabled)return;if(!((i=e.dataTransfer)==null?void 0:i.getData("application/ft-task-id"))){const n=(r=(s=e.target).closest)==null?void 0:r.call(s,"ft-tree-node");n!=null&&n.task&&(this.draggedTaskId=n.task.id,this._dragDescendants=hn(n.task.id,this.store))}}onForeignDragStart(e,t){this.isReparentDisabled||(this.draggedTaskId=t,this._dragDescendants=hn(t,this.store),e.dataTransfer.setData("application/ft-task-id",t),e.dataTransfer.effectAllowed="move")}onNodeDragOver(e,t){var i;!this.draggedTaskId||this.draggedTaskId===t||(i=this._dragDescendants)!=null&&i.has(t)||(e.preventDefault(),e.dataTransfer.dropEffect="move",this.dropTargetId=t)}onNodeDragLeave(){this.dropTargetId=null}async onNodeDrop(e,t){if(this.isReparentDisabled)return;e.preventDefault(),e.stopPropagation();const i=this.draggedTaskId||e.dataTransfer.getData("application/ft-task-id");!i||i===t||hn(i,this.store).has(t)||(await this.reparentTask(i,t),this.draggedTaskId=null,this.dropTargetId=null,this._dragDescendants=null)}onCanvasDragOver(e){this.draggedTaskId&&(e.preventDefault(),e.dataTransfer.dropEffect="move")}async onCanvasDrop(e){if(this.isReparentDisabled)return;const t=this.draggedTaskId||e.dataTransfer.getData("application/ft-task-id");t&&(e.preventDefault(),await this.reparentTask(t,null),this.draggedTaskId=null,this.dropTargetId=null,this._dragDescendants=null)}onDragEnd(){this.draggedTaskId=null,this.dropTargetId=null,this._dragDescendants=null}async reparentTask(e,t){if(this.isReparentDisabled)return;const i=this.store.getTask(e);if(!i)return;const s=i.parentTaskId;this.store.upsert({...i,parentTaskId:t??void 0}),this.lastStructureKey="";try{if(this.client){const r=t!==null?{parentTaskId:t}:{parentTaskId:null};await this.client.updateTask(e,r)}}catch(r){this.store.upsert({...i,parentTaskId:s}),this.lastStructureKey="",this.dispatchEvent(new CustomEvent("write-error",{detail:{error:r},bubbles:!0,composed:!0}))}}onMinimapPan(e){this.cancelPanAnimation(),this.panX=e.detail.panX,this.panY=e.detail.panY}onMinimapWheel(e){this.cancelPanAnimation();const t=e.detail.deltaY>0?.9:1.1,i=Math.min(3,Math.max(.3,this.scale*t)),s=this.containerWidth/this.scale,r=this.containerHeight/this.scale,n=this.panX+s/2,o=this.panY+r/2;this.panX=n-this.containerWidth/i/2,this.panY=o-this.containerHeight/i/2,this.scale=i}render(){if(this.store.allTasks.length===0)return T`<ft-empty-state
        icon="diagram-3"
        heading="No tasks to display"
        subtitle="Tasks will appear here when added to this collection"
      ></ft-empty-state>`;this.runLayout();const e=this.containerWidth/this.scale,t=this.containerHeight/this.scale,i=this._dragDescendants??new Set;return T`
      <ft-hierarchy-nav
        .store=${this.store}
        .focusRootId=${this.focusRootId}
        .isolateMode=${this.isolateMode}
        .selectedTaskId=${this.selectedTaskId}
        .maxDepth=${this.maxDepth}
        .layoutOrientation=${this.layoutOrientation}
        @focus-change=${this.onFocusChange}
        @level-change=${this.onLevelChange}
        @layout-orientation-toggle=${this.onLayoutOrientationToggle}
      ></ft-hierarchy-nav>

      <div class="canvas-container">
        <svg
          class=${this.isPanning?"panning":""}
          viewBox="${this.panX} ${this.panY} ${e} ${t}"
          @mousedown=${this.onMouseDown}
          @wheel=${this.onWheel}
          @dragover=${this.onCanvasDragOver}
          @drop=${this.onCanvasDrop}
          @dragend=${this.onDragEnd}
          @dragstart=${this.onDragStartCapture}
        >
          <g class="edges">
            ${this.layoutEdges.map(s=>Ji`<path
                  d="${Qv(s.points)}"
                  class="edge-hierarchy"
                />`)}
          </g>
          <g class="nodes">
            ${this.layoutNodes.map(s=>{const r=this.dropTargetId===s.id,n=this.draggedTaskId!==null&&i.has(s.id);let o="";r&&(o="drop-target"),n&&(o="drag-invalid");const a=this.selectedTaskId===s.id;return Ji`
                <foreignObject
                  x="${s.x-s.width/2}"
                  y="${s.y-s.height/2}"
                  width="${s.width}"
                  height="${s.height}"
                  class="${o}"
                  overflow="${a?"visible":"hidden"}"
                  @click=${()=>this.onNodeClick(s.id)}
                  @dblclick=${()=>this.onNodeDblClick(s.id)}
                  @dragstart=${c=>this.onForeignDragStart(c,s.id)}
                  @dragover=${c=>this.onNodeDragOver(c,s.id)}
                  @dragleave=${()=>this.onNodeDragLeave()}
                  @drop=${c=>this.onNodeDrop(c,s.id)}
                >
                  <ft-tree-node
                    .task=${s.task}
                    ?selected=${this.selectedTaskId===s.id}
                    ?readOnly=${this.readOnly}
                    .childCount=${this.store.getChildren(s.id).length}
                    ?expanded=${this.expandedNodes.has(s.id)}
                    @toggle-expand=${this.onToggleExpand}
                  ></ft-tree-node>
                </foreignObject>
              `})}
          </g>
        </svg>
        <ft-minimap
          .nodes=${this.layoutNodes}
          .edges=${this.layoutEdges}
          .panX=${this.panX}
          .panY=${this.panY}
          .scale=${this.scale}
          .containerWidth=${this.containerWidth}
          .containerHeight=${this.containerHeight}
          @minimap-pan=${this.onMinimapPan}
          @minimap-wheel=${this.onMinimapWheel}
        ></ft-minimap>
      </div>
    `}};Ve.styles=ee`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .canvas-container {
      flex: 1;
      min-height: 0;
      position: relative;
      overflow: hidden;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      cursor: grab;
    }
    svg.panning {
      cursor: grabbing;
    }
    .edge-hierarchy {
      stroke: var(--sl-color-neutral-400, #64748b);
      stroke-width: 2;
      fill: none;
    }
    .drop-target {
      filter: drop-shadow(0 0 6px rgba(99, 102, 241, 0.6));
    }
    .drag-invalid {
      opacity: 0.3;
    }
  `;Ve.TARGET_NODE_VIEWPORT_FRACTION=.2;Ve.PAN_DURATION_MS=750;gt([k({attribute:!1})],Ve.prototype,"store",2);gt([k({attribute:"selected-task-id"})],Ve.prototype,"selectedTaskId",2);gt([k({attribute:!1})],Ve.prototype,"client",2);gt([k({type:Boolean})],Ve.prototype,"readOnly",2);gt([k({attribute:!1})],Ve.prototype,"capabilities",2);gt([k({attribute:!1})],Ve.prototype,"layoutOrientation",2);gt([U()],Ve.prototype,"focusRootId",2);gt([k({type:Boolean})],Ve.prototype,"isolateMode",2);gt([U()],Ve.prototype,"maxDepth",2);gt([U()],Ve.prototype,"panX",2);gt([U()],Ve.prototype,"panY",2);gt([U()],Ve.prototype,"scale",2);gt([U()],Ve.prototype,"draggedTaskId",2);gt([U()],Ve.prototype,"dropTargetId",2);gt([U()],Ve.prototype,"isPanning",2);gt([U()],Ve.prototype,"expandedNodes",2);Ve=gt([Oe("ft-tree-view")],Ve);function no(e,t){if(e.availability)return e.availability.available;if(e.phase!==ne.OPEN||e.stage!==W.ACCEPTED||e.assignees.length>0||e.holdReason!==void 0||ey(e))return!1;for(const i of e.relationships){if(i.type!==fe.BLOCKED_BY)continue;const s=t.getTask(i.targetTaskId);if(s&&s.stage!==W.COMPLETED)return!1}return!0}function ey(e){if(!e.startDate)return!1;const t=new Date(e.startDate).getTime();return Number.isFinite(t)&&t>Date.now()}const oc={[Q.UNSPECIFIED]:"neutral",[Q.URGENT]:"danger",[Q.HIGH]:"warning",[Q.NORMAL]:"primary",[Q.LOW]:"neutral"},Pn={[Q.UNSPECIFIED]:"No priority",[Q.URGENT]:"Urgent",[Q.HIGH]:"High",[Q.NORMAL]:"Normal",[Q.LOW]:"Low"},ac={[W.TRIAGE]:"Triage",[W.ACCEPTED]:"Accepted",[W.WORKING]:"Working",[W.IN_REVIEW]:"In Review",[W.IN_QA]:"In QA",[W.DEPLOYING]:"Deploying",[W.COMPLETED]:"Completed",[W.WONT_FIX]:"Won't Fix",[W.DUPLICATE]:"Duplicate",[W.CANCELLED]:"Cancelled"},lc={[W.TRIAGE]:"var(--ft-stage-triage)",[W.ACCEPTED]:"var(--ft-stage-accepted)",[W.WORKING]:"var(--ft-stage-working)",[W.IN_REVIEW]:"var(--ft-stage-in-review)",[W.IN_QA]:"var(--ft-stage-in-qa)",[W.DEPLOYING]:"var(--ft-stage-deploying)",[W.COMPLETED]:"var(--ft-stage-completed)",[W.CANCELLED]:"var(--ft-stage-cancelled)"},ty={[fe.BLOCKED_BY]:"Blocked by",[fe.BLOCKS]:"Blocks",[fe.RELATED]:"Related",[fe.DUPLICATE]:"Duplicate of"},iy=[fe.BLOCKED_BY,fe.BLOCKS,fe.RELATED,fe.DUPLICATE];var sy=Object.defineProperty,ry=Object.getOwnPropertyDescriptor,Xr=(e,t,i,s)=>{for(var r=s>1?void 0:s?ry(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&sy(t,i,r),r};let Ts=class extends ye{constructor(){super(...arguments),this.selectedTaskId=null,this.phaseFilter=null,this.assigneeFilter=null}connectedCallback(){super.connectedCallback(),new Is(this,this.store)}updated(e){e.has("selectedTaskId")&&this.selectedTaskId&&this.scrollToSelectedRow()}async scrollToSelectedRow(){await this.updateComplete;const e=this.renderRoot.querySelector(".queue-row.selected");e&&e.scrollIntoView({behavior:"smooth",block:"nearest"})}isReady(e){return no(e,this.store)}countBlocks(e){let t=0;for(const i of e.relationships){if(i.type!==fe.BLOCKS)continue;const s=this.store.getTask(i.targetTaskId);s&&s.phase!==ne.CLOSED&&t++}return t}getReadyTasks(){return this.store.allTasks.filter(e=>this.isReady(e)&&Dn(e,this.phaseFilter,this.assigneeFilter)).sort((e,t)=>{const i=e.priority??Q.UNSPECIFIED,s=t.priority??Q.UNSPECIFIED,r=i===Q.UNSPECIFIED?5:i,n=s===Q.UNSPECIFIED?5:s;return r!==n?r-n:e.name.localeCompare(t.name)})}shortId(e){return e.length>8?`...${e.slice(-6)}`:e}onRowClick(e){this.dispatchEvent(new CustomEvent("task-select",{detail:{taskId:e},bubbles:!0,composed:!0}))}onRowKeyDown(e,t){e.target===e.currentTarget&&(e.key!=="Enter"&&e.key!==" "||(e.preventDefault(),this.onRowClick(t)))}render(){if(this.store.isLoading)return T`<div style="display:flex;align-items:center;justify-content:center;height:100%;"><sl-spinner style="font-size:2rem;"></sl-spinner></div>`;const e=this.getReadyTasks();return e.length===0?T`
        <ft-empty-state
          icon="check-circle"
          heading="All clear!"
          subtitle="No tasks are available to work on right now"
        ></ft-empty-state>
      `:T`
      <div class="queue">
        <h2 class="queue-header">Available Queue (${e.length})</h2>
        <div class="queue-list" role="listbox" aria-label="Available tasks">
          ${e.map(t=>this.renderRow(t))}
        </div>
      </div>
    `}renderRow(e){const t=e.priority??Q.UNSPECIFIED,i=oc[t]??"neutral",s=Pn[t]??"Unknown",r=this.countBlocks(e),n=ac[e.stage]??"",o=lc[e.stage]??"var(--sl-color-neutral-400)",a=3,c=e.labels.slice(0,a),d=e.labels.length-a;return T`
      <div
        class=${Ce({"queue-row":!0,selected:this.selectedTaskId===e.id})}
        tabindex="0"
        role="option"
        aria-label=${`Task: ${e.name}`}
        aria-selected=${String(this.selectedTaskId===e.id)}
        @click=${()=>this.onRowClick(e.id)}
        @keydown=${l=>this.onRowKeyDown(l,e.id)}
      >
        <span class="priority-cell"><sl-badge variant=${i} pill>${s}</sl-badge></span>

        ${e.type?T`<span class="task-type">${e.type}</span>`:Z}

        <span class="task-id">${this.shortId(e.id)}</span>

        <span class="task-title">${e.name}</span>

        ${c.length>0?T`
              <div class="labels">
                ${c.map(l=>T`<sl-tag size="small" variant="neutral">${l}</sl-tag>`)}
                ${d>0?T`<span class="overflow-label">+${d} more</span>`:Z}
              </div>
            `:Z}

        ${r>0?T`<sl-badge class="blocks-badge" variant="warning" pill>Blocks ${r}</sl-badge>`:Z}

        <span
          class="stage-badge"
          style="background: color-mix(in srgb, ${o} 15%, transparent); color: ${o};"
        >
          <span class="stage-dot" style="background: ${o};"></span>
          ${n}
        </span>
      </div>
    `}};Ts.styles=ee`
    :host {
      display: block;
      height: 100%;
    }

    .queue {
      max-width: 960px;
      margin: 0 auto;
      padding: 1rem 0;
    }

    .queue-header {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--sl-color-neutral-500);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin: 0 0 0.75rem;
    }

    .queue-list {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .queue-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0.75rem;
      border: 1px solid var(--sl-color-neutral-200);
      border-radius: var(--sl-border-radius-medium);
      background: var(--sl-color-neutral-0);
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    }

    .queue-row:hover {
      background: var(--sl-color-neutral-50);
      border-color: var(--sl-color-neutral-300);
    }

    .queue-row:focus {
      outline: none;
    }

    .queue-row:focus-visible {
      outline: 2px solid var(--sl-color-primary-500);
      outline-offset: 2px;
    }

    .queue-row.selected {
      border-color: var(--sl-color-primary-500);
      box-shadow: 0 0 0 1px var(--sl-color-primary-500);
    }

    .task-type {
      color: var(--sl-color-neutral-500);
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      flex-shrink: 0;
      min-width: 3rem;
    }

    .task-id {
      font-size: 0.75rem;
      color: var(--sl-color-neutral-500);
      font-family: var(--sl-font-mono);
      flex-shrink: 0;
    }

    .task-title {
      flex: 1;
      min-width: 0;
      font-size: 0.875rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .labels {
      display: flex;
      gap: 0.25rem;
      flex-shrink: 0;
    }

    sl-tag::part(base) {
      font-size: 0.75rem;
      padding: 0 0.35rem;
      height: 1.25rem;
    }

    .overflow-label {
      font-size: 0.75rem;
      color: var(--sl-color-neutral-500);
      line-height: 1.25rem;
    }

    .priority-cell {
      display: inline-flex;
      flex-shrink: 0;
      min-width: 6.5rem;
    }

    .blocks-badge {
      flex-shrink: 0;
    }

    .stage-badge {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      white-space: nowrap;
    }

    .stage-dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      flex-shrink: 0;
    }
  `;Xr([k({attribute:!1})],Ts.prototype,"store",2);Xr([k({attribute:"selected-task-id"})],Ts.prototype,"selectedTaskId",2);Xr([k({attribute:!1})],Ts.prototype,"phaseFilter",2);Xr([k({attribute:!1})],Ts.prototype,"assigneeFilter",2);Ts=Xr([Oe("ft-ready-queue-view")],Ts);const oo=ee`
  sl-icon-button {
    --sl-focus-ring: 2px solid var(--sl-color-primary-500);
    --sl-focus-ring-offset: 2px;
  }

  sl-icon-button::part(base):focus-visible {
    border-radius: var(--sl-border-radius-medium);
  }
`;var ny=Object.defineProperty,oy=Object.getOwnPropertyDescriptor,Jr=(e,t,i,s)=>{for(var r=s>1?void 0:s?oy(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&ny(t,i,r),r};const ay={[ne.OPEN]:"Open",[ne.IN_PROGRESS]:"In Progress",[ne.ON_HOLD]:"On Hold",[ne.CLOSED]:"Closed"},ly=[Q.UNSPECIFIED,Q.URGENT,Q.HIGH,Q.NORMAL,Q.LOW];let Cs=class extends ye{constructor(){super(...arguments),this.readOnly=!1,this.isEditingPriority=!1,this.prevTaskId=""}willUpdate(e){var i;if(!e.has("task"))return;const t=((i=this.task)==null?void 0:i.id)??"";t!==this.prevTaskId&&(this.prevTaskId=t,this.resetEditState())}stopInspectorInteraction(e){e.stopPropagation()}async startPriorityEdit(e){var i;if(this.readOnly)return;e.stopPropagation(),this.isEditingPriority=!0,await this.updateComplete;const t=this.renderRoot.querySelector("sl-select.priority-select");t==null||t.focus(),(i=t==null?void 0:t.show)==null||i.call(t)}onPriorityChange(e){e.stopPropagation();const t=Number(e.currentTarget.value);if(Number.isNaN(t))return;const i=t;this.isEditingPriority=!1,i!==(this.task.priority??Q.UNSPECIFIED)&&this.dispatchTaskUpdate({priority:i})}onPriorityBlur(){this.isEditingPriority=!1}onPriorityKeyDown(e){e.key==="Escape"&&(e.preventDefault(),e.stopPropagation(),this.onPriorityBlur())}resetEditState(){this.isEditingPriority=!1}dispatchTaskUpdate(e){this.dispatchEvent(new CustomEvent("task-update",{detail:{taskId:this.task.id,fields:e},bubbles:!0,composed:!0}))}renderPriorityEditor(e){return T`
      <sl-select
        class="priority-select"
        size="small"
        value=${String(e)}
        hoist
        @mousedown=${this.stopInspectorInteraction}
        @click=${this.stopInspectorInteraction}
        @keydown=${this.onPriorityKeyDown}
        @sl-change=${this.onPriorityChange}
        @sl-after-hide=${this.onPriorityBlur}
      >
        ${ly.map(t=>T`
            <sl-option value=${String(t)}>${Pn[t]}</sl-option>
          `)}
      </sl-select>
    `}renderPriorityBadge(e,t){return T`
      <button
        class="priority-button"
        type="button"
        aria-label="Edit priority, current: ${e}"
        title="Edit priority"
        @mousedown=${this.stopInspectorInteraction}
        @click=${this.startPriorityEdit}
      >
        <sl-badge variant=${t} pill>${e}</sl-badge>
      </button>
    `}render(){const e=this.task,t=ay[e.phase]??"",i=ac[e.stage]??"",s=lc[e.stage]??"var(--sl-color-neutral-500)",r=e.priority??Q.UNSPECIFIED,n=oc[r]??"neutral",o=Pn[r]??"Unknown";return T`
      <div class="title">${e.name}</div>
      <div class="badges">
        ${t?T`<sl-badge variant="neutral">${t}</sl-badge>`:Z}
        ${i?T`<span class="stage-badge" style="background:${s}">${i}</span>`:Z}
        ${this.readOnly?T`<sl-badge variant=${n} pill>${o}</sl-badge>`:this.isEditingPriority?this.renderPriorityEditor(r):this.renderPriorityBadge(o,n)}
      </div>
    `}};Cs.styles=[oo,ee`
    :host {
      display: block;
    }
    .title {
      font-size: 1.125rem;
      font-weight: 600;
      line-height: 1.4;
      margin-bottom: 0.75rem;
      word-break: break-word;
    }
    .badges {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      align-items: center;
    }
    .stage-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
      color: #fff;
    }
    .priority-button {
      border: 0;
      background: transparent;
      padding: 0;
      cursor: pointer;
      line-height: 1;
    }
    .priority-button:focus-visible {
      outline: 2px solid var(--sl-color-primary-500);
      outline-offset: 2px;
      border-radius: 999px;
    }
    sl-select.priority-select {
      width: 7rem;
      --sl-input-height-small: 1.5rem;
      --sl-input-font-size-small: 0.75rem;
    }
  `];Jr([k({attribute:!1})],Cs.prototype,"task",2);Jr([k({type:Boolean})],Cs.prototype,"readOnly",2);Jr([k({attribute:!1})],Cs.prototype,"capabilities",2);Jr([U()],Cs.prototype,"isEditingPriority",2);Cs=Jr([Oe("ft-inspector-header")],Cs);function Ap(e){try{return new Date(e).toLocaleString(void 0,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}catch{return e}}function Sa(e){if(!e)return"";try{return new Date(e).toLocaleDateString(void 0,{year:"numeric",month:"short",day:"numeric"})}catch{return e}}const cy=Object.freeze({canEditTitle:!0,canEditDescription:!0,canChangeStage:!0,canChangePriority:!0,canChangeAssignee:!0,canChangeParent:!0,canAddComment:!0,canCloseTask:!0,canCreateTask:!0,canDeleteTask:!0,canEditDates:!0,canEditAcceptance:!0,canEditRelationships:!0,canEditCodeContext:!0,canDragReorder:!0}),dy=Object.freeze({canEditTitle:!0,canEditDescription:!0,canChangeStage:!0,canChangePriority:!0,canChangeAssignee:!0,canChangeParent:!0,canAddComment:!0,canCloseTask:!0,canCreateTask:!0,canDeleteTask:!1,canEditDates:!1,canEditAcceptance:!1,canEditRelationships:!1,canEditCodeContext:!1,canDragReorder:!1}),uy=Object.freeze({canEditTitle:!1,canEditDescription:!1,canChangeStage:!1,canChangePriority:!1,canChangeAssignee:!1,canChangeParent:!1,canAddComment:!1,canCloseTask:!1,canCreateTask:!1,canDeleteTask:!1,canEditDates:!1,canEditAcceptance:!1,canEditRelationships:!1,canEditCodeContext:!1,canDragReorder:!1}),yu={canEditDates:"No native date fields on GitHub issues"};function hy(e){if(e.platform===ke.FARMTABLE)return cy;if(e.platform===ke.GITHUB){const t=e.remoteData;if(t&&typeof t=="object"&&"writable"in t&&t.writable===!0)return dy}return uy}var py=Object.defineProperty,fy=Object.getOwnPropertyDescriptor,di=(e,t,i,s)=>{for(var r=s>1?void 0:s?fy(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&py(t,i,r),r};let qt=class extends ye{constructor(){super(...arguments),this.readOnly=!1,this.editingDate=null,this.dateDraft="",this.addingLabel=!1,this.labelDraft="",this.pickingAssignee=!1,this.availableUsers=[],this.userCache=null,this.prevTaskId="",this.onDocumentKeyDown=e=>{e.key==="Escape"&&this.pickingAssignee&&(e.preventDefault(),e.stopPropagation(),this.cancelAssigneePick())},this.onDocumentPointerDown=e=>{this.hasActiveEditor()&&(e.composedPath().includes(this)||this.resetEditState())}}willUpdate(e){var i;if(!e.has("task"))return;const t=((i=this.task)==null?void 0:i.id)??"";t!==this.prevTaskId&&(this.prevTaskId=t,this.resetEditState())}disconnectedCallback(){super.disconnectedCallback(),this.removeDismissListener(),document.removeEventListener("keydown",this.onDocumentKeyDown,{capture:!0})}async startDateEdit(e){var t,i;this.readOnly||((t=this.capabilities)==null?void 0:t.canEditDates)===!1||(this.editingDate=e,this.dateDraft=this.dateInputValue(this.task[e]),this.addDismissListener(),await this.updateComplete,(i=this.renderRoot.querySelector("sl-input.date-input"))==null||i.focus())}onDateInput(e){this.dateDraft=e.currentTarget.value}onDateKeyDown(e){e.key==="Enter"?(e.preventDefault(),this.saveDateEdit()):e.key==="Escape"&&(e.preventDefault(),e.stopPropagation(),this.cancelDateEdit())}saveDateEdit(){if(!this.editingDate)return;const e=this.editingDate,t=this.dateInputValue(this.task[e]),i=this.dateDraft?`${this.dateDraft}T00:00:00.000Z`:null;this.editingDate=null,this.removeDismissListenerIfIdle(),this.dateDraft!==t&&this.dispatchTaskUpdate({[e]:i})}clearDateEdit(e){var t;this.readOnly||((t=this.capabilities)==null?void 0:t.canEditDates)===!1||(this.editingDate=null,this.task[e]&&this.dispatchTaskUpdate({[e]:null}))}cancelDateEdit(){this.editingDate=null,this.dateDraft="",this.removeDismissListenerIfIdle()}onLabelRemove(e){if(this.readOnly)return;const t=e.currentTarget.dataset.label;t&&this.dispatchTaskUpdate({removeLabels:[t]})}async startLabelAdd(){var e;this.readOnly||(this.addingLabel=!0,this.labelDraft="",this.addDismissListener(),await this.updateComplete,(e=this.renderRoot.querySelector("sl-input.label-input"))==null||e.focus())}onLabelInput(e){this.labelDraft=e.currentTarget.value}onLabelKeyDown(e){e.key==="Enter"?(e.preventDefault(),this.saveLabelAdd()):e.key==="Escape"&&(e.preventDefault(),e.stopPropagation(),this.cancelLabelAdd())}saveLabelAdd(){const e=this.labelDraft.trim();e&&(this.addingLabel=!1,this.labelDraft="",this.removeDismissListenerIfIdle(),!this.task.labels.includes(e)&&this.dispatchTaskUpdate({addLabels:[e]}))}cancelLabelAdd(){this.addingLabel=!1,this.labelDraft="",this.removeDismissListenerIfIdle()}onAssigneeRemove(e){var r;if(this.readOnly||((r=this.capabilities)==null?void 0:r.canChangeAssignee)===!1)return;const t=e.currentTarget.dataset.userId;if(!t)return;const s=this.task.assignees.map(n=>n.id).filter(n=>n!==t);s.length===0?this.dispatchTaskUpdate({clearAssignees:!0}):this.dispatchTaskUpdate({assigneeIds:s})}async startAssigneePick(){var e;if(!(this.readOnly||((e=this.capabilities)==null?void 0:e.canChangeAssignee)===!1)&&this.client){this.pickingAssignee=!0,this.addDismissListener();try{this.userCache||(this.userCache=await this.client.listUsers()),this.availableUsers=this.userCache}catch{this.availableUsers=[]}}}cancelAssigneePick(){this.pickingAssignee=!1,this.removeDismissListenerIfIdle()}onAssigneeSelect(e){const t=this.task.assignees.map(i=>i.id);t.includes(e)||(this.pickingAssignee=!1,this.removeDismissListenerIfIdle(),this.dispatchTaskUpdate({assigneeIds:[...t,e]}))}connectedCallback(){super.connectedCallback(),document.addEventListener("keydown",this.onDocumentKeyDown,{capture:!0})}dispatchTaskUpdate(e){this.dispatchEvent(new CustomEvent("task-update",{detail:{taskId:this.task.id,fields:e},bubbles:!0,composed:!0}))}dateInputValue(e){if(!e)return"";const t=new Date(e);return Number.isNaN(t.getTime())?"":t.toISOString().slice(0,10)}resetEditState(){this.editingDate=null,this.dateDraft="",this.addingLabel=!1,this.labelDraft="",this.pickingAssignee=!1,this.availableUsers=[],this.removeDismissListener()}hasActiveEditor(){return this.editingDate!==null||this.addingLabel||this.pickingAssignee}addDismissListener(){document.addEventListener("pointerdown",this.onDocumentPointerDown,{capture:!0})}removeDismissListenerIfIdle(){this.hasActiveEditor()||this.removeDismissListener()}removeDismissListener(){document.removeEventListener("pointerdown",this.onDocumentPointerDown,{capture:!0})}renderDateCell(e,t,i){const s=this.editingDate===t;return T`
      <div class="date-cell">
        <span class="label">${e}</span>
        <span class="value">
          ${s?T`
                <span class="date-editor">
                  <sl-input
                    class="date-input"
                    size="small"
                    type="date"
                    .value=${this.dateDraft}
                    @input=${this.onDateInput}
                    @keydown=${this.onDateKeyDown}
                  ></sl-input>
                  <span class="edit-buttons">
                    <sl-icon-button
                      name="check2"
                      label="Save ${e}"
                      @click=${this.saveDateEdit}
                    ></sl-icon-button>
                    <sl-icon-button
                      name="x-lg"
                      label="Cancel ${e} edit"
                      @click=${this.cancelDateEdit}
                    ></sl-icon-button>
                  </span>
                </span>
              `:T`
                <span class="date-value">
                  ${i?T`${Sa(i)}`:T`<span class="empty">None</span>`}
                  <sl-icon-button
                    name="pencil"
                    label="Edit ${e}"
                    @click=${()=>this.startDateEdit(t)}
                  ></sl-icon-button>
                  ${i?T`
                        <sl-icon-button
                          name="x-lg"
                          label="Clear ${e}"
                          @click=${()=>this.clearDateEdit(t)}
                        ></sl-icon-button>
                      `:Z}
                </span>
              `}
        </span>
      </div>
    `}renderReadOnlyDateCell(e,t){return T`
      <div class="date-cell">
        <span class="label">${e}</span>
        <span class="value">${t?Sa(t):"—"}</span>
      </div>
    `}renderDisabledDateCell(e,t,i){return T`
      <div class="date-cell">
        <span class="label">${e}</span>
        <sl-tooltip content=${i} hoist>
          <span class="value" style="cursor: not-allowed; opacity: 0.6;">${t?Sa(t):"—"}</span>
        </sl-tooltip>
      </div>
    `}renderAssignees(){var s;const e=this.task.assignees,t=new Set(e.map(r=>r.id)),i=this.availableUsers.filter(r=>!t.has(r.id));return T`
      <span class="assignees">
        ${e.length>0?e.map(r=>{var n;return T`
                <sl-tag
                  data-user-id=${r.id}
                  size="small"
                  variant="neutral"
                  ?removable=${!this.readOnly&&((n=this.capabilities)==null?void 0:n.canChangeAssignee)!==!1}
                  @sl-remove=${this.onAssigneeRemove}
                >
                  ${r.name}
                </sl-tag>
              `}):T`<span class="empty">Unassigned</span>`}
        ${this.pickingAssignee?T`
              <sl-icon-button
                name="x-lg"
                label="Cancel assignee pick"
                @click=${this.cancelAssigneePick}
              ></sl-icon-button>
              <div class="assignee-picker">
                ${i.length>0?i.map(r=>T`
                        <span class="assignee-option" @click=${()=>this.onAssigneeSelect(r.id)}>
                          <sl-avatar
                            initials=${r.name.slice(0,2)}
                            label=${r.name}
                            style="--size: 1.4rem; font-size: 0.55rem;"
                          ></sl-avatar>
                          ${r.name}
                        </span>
                      `):T`<span class="empty">No users available</span>`}
              </div>
            `:this.client&&!this.readOnly&&((s=this.capabilities)==null?void 0:s.canChangeAssignee)!==!1?T`
                <sl-icon-button
                  name="plus-lg"
                  label="Add assignee"
                  @click=${this.startAssigneePick}
                ></sl-icon-button>
              `:Z}
      </span>
    `}renderLabels(){const e=this.task.labels;return T`
      <span class="labels">
        ${e.length>0?e.map(t=>T`
                <sl-tag
                  data-label=${t}
                  size="small"
                  variant="neutral"
                  ?removable=${!this.readOnly}
                  @sl-remove=${this.onLabelRemove}
                >
                  ${t}
                </sl-tag>
              `):T`<span class="empty">None</span>`}
        ${this.addingLabel?T`
              <sl-input
                class="label-input"
                size="small"
                maxlength="100"
                .value=${this.labelDraft}
                @input=${this.onLabelInput}
                @keydown=${this.onLabelKeyDown}
              ></sl-input>
              <sl-icon-button
                name="check2"
                label="Add label"
                @click=${this.saveLabelAdd}
              ></sl-icon-button>
              <sl-icon-button
                name="x-lg"
                label="Cancel label add"
                @click=${this.cancelLabelAdd}
              ></sl-icon-button>
            `:this.readOnly?Z:T`
              <sl-icon-button
                name="plus-lg"
                label="Add label"
                @click=${this.startLabelAdd}
              ></sl-icon-button>
            `}
      </span>
    `}render(){var t,i;const e=this.task;return T`
      <div class="row">
        <span class="label">Assignees</span>
        <span class="value">${this.renderAssignees()}</span>
      </div>

      ${e.remoteUrl?T`<div class="row">
            <span class="label">External Source</span>
            <span class="value">
              <a
                href=${e.remoteUrl}
                target="_blank"
                rel="noopener"
                class="external-source-link"
              >
                <sl-icon name="box-arrow-up-right"></sl-icon>
                <span>Open External Source</span>
              </a>
            </span>
          </div>`:Z}

      ${e.type?T`<div class="row">
            <span class="label">Type</span>
            <span class="value">${e.type}</span>
          </div>`:Z}

      <div class="row">
        <span class="label">Labels</span>
        <span class="value">${this.renderLabels()}</span>
      </div>

      <div class="date-grid">
        ${this.readOnly?this.renderReadOnlyDateCell("Start date",e.startDate):((t=this.capabilities)==null?void 0:t.canEditDates)===!1?this.renderDisabledDateCell("Start date",e.startDate,yu.canEditDates):this.renderDateCell("Start date","startDate",e.startDate)}
        ${this.readOnly?this.renderReadOnlyDateCell("Due date",e.dueDate):((i=this.capabilities)==null?void 0:i.canEditDates)===!1?this.renderDisabledDateCell("Due date",e.dueDate,yu.canEditDates):this.renderDateCell("Due date","dueDate",e.dueDate)}
        ${this.renderReadOnlyDateCell("Created",e.createdAt)}
        ${this.renderReadOnlyDateCell("Updated",e.updatedAt)}
      </div>
    `}};qt.styles=[oo,ee`
    :host {
      display: block;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 0.375rem 0;
      font-size: 0.8125rem;
      gap: 0.5rem;
    }
    .label {
      color: var(--sl-color-neutral-500);
      flex-shrink: 0;
      min-width: 5rem;
    }
    .value {
      text-align: right;
      word-break: break-word;
    }
    .assignees {
      display: flex;
      gap: 0.375rem;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .labels {
      display: flex;
      gap: 0.25rem;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: center;
    }
    .empty {
      color: var(--sl-color-neutral-400);
      font-style: italic;
    }
    .date-value {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.25rem;
      flex-wrap: wrap;
    }
    .date-editor {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.25rem;
      flex-wrap: wrap;
    }
    .date-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.25rem 0.75rem;
      padding: 0.375rem 0;
      font-size: 0.8125rem;
    }
    .date-cell {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      min-width: 0;
    }
    .date-cell .label {
      color: var(--sl-color-neutral-500);
      font-size: 0.75rem;
    }
    .date-cell .value {
      text-align: left;
      word-break: break-word;
    }
    .date-cell .date-value {
      justify-content: flex-start;
    }
    .date-cell .date-editor {
      justify-content: flex-start;
      flex-direction: column;
      align-items: flex-start;
    }
    .date-cell sl-input.date-input {
      width: 100%;
    }
    .date-cell .edit-buttons {
      display: flex;
      gap: 0.125rem;
    }
    sl-input.date-input {
      --sl-input-height-small: 1.75rem;
      --sl-input-font-size-small: 0.8125rem;
    }
    sl-input.label-input {
      width: 8rem;
      --sl-input-height-small: 1.75rem;
      --sl-input-font-size-small: 0.8125rem;
    }
    .assignee-picker {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      margin-top: 0.25rem;
    }
    .assignee-option {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.5rem;
      font-size: 0.8125rem;
      cursor: pointer;
      border-radius: var(--sl-border-radius-small);
    }
    .assignee-option:hover {
      background: var(--sl-color-neutral-100);
    }
    .external-source-link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.8125rem;
      color: var(--sl-color-primary-600);
      text-decoration: none;
      padding: 0.125rem 0.5rem;
      border-radius: var(--sl-border-radius-small);
      background: var(--sl-color-primary-50);
    }
    .external-source-link:hover {
      color: var(--sl-color-primary-700);
      background: var(--sl-color-primary-100);
    }
    .external-source-link sl-icon {
      font-size: 0.75rem;
    }
  `];di([k({attribute:!1})],qt.prototype,"task",2);di([k({attribute:!1})],qt.prototype,"client",2);di([k({type:Boolean})],qt.prototype,"readOnly",2);di([k({attribute:!1})],qt.prototype,"capabilities",2);di([U()],qt.prototype,"editingDate",2);di([U()],qt.prototype,"dateDraft",2);di([U()],qt.prototype,"addingLabel",2);di([U()],qt.prototype,"labelDraft",2);di([U()],qt.prototype,"pickingAssignee",2);di([U()],qt.prototype,"availableUsers",2);qt=di([Oe("ft-inspector-meta")],qt);function cc(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}var $s=cc();function Ip(e){$s=e}var Dr={exec:()=>null};function De(e,t=""){let i=typeof e=="string"?e:e.source;const s={replace:(r,n)=>{let o=typeof n=="string"?n:n.source;return o=o.replace(St.caret,"$1"),i=i.replace(r,o),s},getRegex:()=>new RegExp(i,t)};return s}var St={codeRemoveIndent:/^(?: {1,4}| {0,3}\t)/gm,outputLinkReplace:/\\([\[\]])/g,indentCodeCompensation:/^(\s+)(?:```)/,beginningSpace:/^\s+/,endingHash:/#$/,startingSpaceChar:/^ /,endingSpaceChar:/ $/,nonSpaceChar:/[^ ]/,newLineCharGlobal:/\n/g,tabCharGlobal:/\t/g,multipleSpaceGlobal:/\s+/g,blankLine:/^[ \t]*$/,doubleBlankLine:/\n[ \t]*\n[ \t]*$/,blockquoteStart:/^ {0,3}>/,blockquoteSetextReplace:/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,blockquoteSetextReplace2:/^ {0,3}>[ \t]?/gm,listReplaceTabs:/^\t+/,listReplaceNesting:/^ {1,4}(?=( {4})*[^ ])/g,listIsTask:/^\[[ xX]\] /,listReplaceTask:/^\[[ xX]\] +/,anyLine:/\n.*\n/,hrefBrackets:/^<(.*)>$/,tableDelimiter:/[:|]/,tableAlignChars:/^\||\| *$/g,tableRowBlankLine:/\n[ \t]*$/,tableAlignRight:/^ *-+: *$/,tableAlignCenter:/^ *:-+: *$/,tableAlignLeft:/^ *:-+ *$/,startATag:/^<a /i,endATag:/^<\/a>/i,startPreScriptTag:/^<(pre|code|kbd|script)(\s|>)/i,endPreScriptTag:/^<\/(pre|code|kbd|script)(\s|>)/i,startAngleBracket:/^</,endAngleBracket:/>$/,pedanticHrefTitle:/^([^'"]*[^\s])\s+(['"])(.*)\2/,unicodeAlphaNumeric:/[\p{L}\p{N}]/u,escapeTest:/[&<>"']/,escapeReplace:/[&<>"']/g,escapeTestNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,escapeReplaceNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,unescapeTest:/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,caret:/(^|[^\[])\^/g,percentDecode:/%25/g,findPipe:/\|/g,splitPipe:/ \|/,slashPipe:/\\\|/g,carriageReturn:/\r\n|\r/g,spaceLine:/^ +$/gm,notSpaceStart:/^\S*/,endingNewline:/\n$/,listItemRegex:e=>new RegExp(`^( {0,3}${e})((?:[	 ][^\\n]*)?(?:\\n|$))`),nextBulletRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),hrRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),fencesBeginRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}(?:\`\`\`|~~~)`),headingBeginRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}#`),htmlBeginRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}<(?:[a-z].*>|!--)`,"i")},my=/^(?:[ \t]*(?:\n|$))+/,gy=/^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,by=/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,Zr=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,vy=/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,dc=/(?:[*+-]|\d{1,9}[.)])/,Rp=/^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,$p=De(Rp).replace(/bull/g,dc).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/\|table/g,"").getRegex(),yy=De(Rp).replace(/bull/g,dc).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/table/g,/ {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(),uc=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,wy=/^[^\n]+/,hc=/(?!\s*\])(?:\\.|[^\[\]\\])+/,_y=De(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label",hc).replace("title",/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),ky=De(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g,dc).getRegex(),ao="address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",pc=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,Ey=De("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))","i").replace("comment",pc).replace("tag",ao).replace("attribute",/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),Dp=De(uc).replace("hr",Zr).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("|table","").replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",ao).getRegex(),xy=De(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph",Dp).getRegex(),fc={blockquote:xy,code:gy,def:_y,fences:by,heading:vy,hr:Zr,html:Ey,lheading:$p,list:ky,newline:my,paragraph:Dp,table:Dr,text:wy},wu=De("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr",Zr).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("blockquote"," {0,3}>").replace("code","(?: {4}| {0,3}	)[^\\n]").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",ao).getRegex(),Ty={...fc,lheading:yy,table:wu,paragraph:De(uc).replace("hr",Zr).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("table",wu).replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",ao).getRegex()},Cy={...fc,html:De(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment",pc).replace(/tag/g,"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:Dr,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:De(uc).replace("hr",Zr).replace("heading",` *#{1,6} *[^
]`).replace("lheading",$p).replace("|table","").replace("blockquote"," {0,3}>").replace("|fences","").replace("|list","").replace("|html","").replace("|tag","").getRegex()},Sy=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,Oy=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,Np=/^( {2,}|\\)\n(?!\s*$)/,Ay=/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,lo=/[\p{P}\p{S}]/u,mc=/[\s\p{P}\p{S}]/u,Lp=/[^\s\p{P}\p{S}]/u,Iy=De(/^((?![*_])punctSpace)/,"u").replace(/punctSpace/g,mc).getRegex(),Pp=/(?!~)[\p{P}\p{S}]/u,Ry=/(?!~)[\s\p{P}\p{S}]/u,$y=/(?:[^\s\p{P}\p{S}]|~)/u,Dy=/\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g,Mp=/^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/,Ny=De(Mp,"u").replace(/punct/g,lo).getRegex(),Ly=De(Mp,"u").replace(/punct/g,Pp).getRegex(),Fp="^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)",Py=De(Fp,"gu").replace(/notPunctSpace/g,Lp).replace(/punctSpace/g,mc).replace(/punct/g,lo).getRegex(),My=De(Fp,"gu").replace(/notPunctSpace/g,$y).replace(/punctSpace/g,Ry).replace(/punct/g,Pp).getRegex(),Fy=De("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)","gu").replace(/notPunctSpace/g,Lp).replace(/punctSpace/g,mc).replace(/punct/g,lo).getRegex(),zy=De(/\\(punct)/,"gu").replace(/punct/g,lo).getRegex(),By=De(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),Uy=De(pc).replace("(?:-->|$)","-->").getRegex(),qy=De("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment",Uy).replace("attribute",/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),Mn=/(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/,Hy=De(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label",Mn).replace("href",/<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title",/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),zp=De(/^!?\[(label)\]\[(ref)\]/).replace("label",Mn).replace("ref",hc).getRegex(),Bp=De(/^!?\[(ref)\](?:\[\])?/).replace("ref",hc).getRegex(),Vy=De("reflink|nolink(?!\\()","g").replace("reflink",zp).replace("nolink",Bp).getRegex(),gc={_backpedal:Dr,anyPunctuation:zy,autolink:By,blockSkip:Dy,br:Np,code:Oy,del:Dr,emStrongLDelim:Ny,emStrongRDelimAst:Py,emStrongRDelimUnd:Fy,escape:Sy,link:Hy,nolink:Bp,punctuation:Iy,reflink:zp,reflinkSearch:Vy,tag:qy,text:Ay,url:Dr},jy={...gc,link:De(/^!?\[(label)\]\((.*?)\)/).replace("label",Mn).getRegex(),reflink:De(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label",Mn).getRegex()},Ml={...gc,emStrongRDelimAst:My,emStrongLDelim:Ly,url:De(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/,"i").replace("email",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,text:/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/},Gy={...Ml,br:De(Np).replace("{2,}","*").getRegex(),text:De(Ml.text).replace("\\b_","\\b_| {2,}\\n").replace(/\{2,\}/g,"*").getRegex()},pn={normal:fc,gfm:Ty,pedantic:Cy},wr={normal:gc,gfm:Ml,breaks:Gy,pedantic:jy},Wy={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},_u=e=>Wy[e];function yi(e,t){if(t){if(St.escapeTest.test(e))return e.replace(St.escapeReplace,_u)}else if(St.escapeTestNoEncode.test(e))return e.replace(St.escapeReplaceNoEncode,_u);return e}function ku(e){try{e=encodeURI(e).replace(St.percentDecode,"%")}catch{return null}return e}function Eu(e,t){var n;const i=e.replace(St.findPipe,(o,a,c)=>{let d=!1,l=a;for(;--l>=0&&c[l]==="\\";)d=!d;return d?"|":" |"}),s=i.split(St.splitPipe);let r=0;if(s[0].trim()||s.shift(),s.length>0&&!((n=s.at(-1))!=null&&n.trim())&&s.pop(),t)if(s.length>t)s.splice(t);else for(;s.length<t;)s.push("");for(;r<s.length;r++)s[r]=s[r].trim().replace(St.slashPipe,"|");return s}function _r(e,t,i){const s=e.length;if(s===0)return"";let r=0;for(;r<s&&e.charAt(s-r-1)===t;)r++;return e.slice(0,s-r)}function Yy(e,t){if(e.indexOf(t[1])===-1)return-1;let i=0;for(let s=0;s<e.length;s++)if(e[s]==="\\")s++;else if(e[s]===t[0])i++;else if(e[s]===t[1]&&(i--,i<0))return s;return i>0?-2:-1}function xu(e,t,i,s,r){const n=t.href,o=t.title||null,a=e[1].replace(r.other.outputLinkReplace,"$1");s.state.inLink=!0;const c={type:e[0].charAt(0)==="!"?"image":"link",raw:i,href:n,title:o,text:a,tokens:s.inlineTokens(a)};return s.state.inLink=!1,c}function Ky(e,t,i){const s=e.match(i.other.indentCodeCompensation);if(s===null)return t;const r=s[1];return t.split(`
`).map(n=>{const o=n.match(i.other.beginningSpace);if(o===null)return n;const[a]=o;return a.length>=r.length?n.slice(r.length):n}).join(`
`)}var Fn=class{constructor(e){he(this,"options");he(this,"rules");he(this,"lexer");this.options=e||$s}space(e){const t=this.rules.block.newline.exec(e);if(t&&t[0].length>0)return{type:"space",raw:t[0]}}code(e){const t=this.rules.block.code.exec(e);if(t){const i=t[0].replace(this.rules.other.codeRemoveIndent,"");return{type:"code",raw:t[0],codeBlockStyle:"indented",text:this.options.pedantic?i:_r(i,`
`)}}}fences(e){const t=this.rules.block.fences.exec(e);if(t){const i=t[0],s=Ky(i,t[3]||"",this.rules);return{type:"code",raw:i,lang:t[2]?t[2].trim().replace(this.rules.inline.anyPunctuation,"$1"):t[2],text:s}}}heading(e){const t=this.rules.block.heading.exec(e);if(t){let i=t[2].trim();if(this.rules.other.endingHash.test(i)){const s=_r(i,"#");(this.options.pedantic||!s||this.rules.other.endingSpaceChar.test(s))&&(i=s.trim())}return{type:"heading",raw:t[0],depth:t[1].length,text:i,tokens:this.lexer.inline(i)}}}hr(e){const t=this.rules.block.hr.exec(e);if(t)return{type:"hr",raw:_r(t[0],`
`)}}blockquote(e){const t=this.rules.block.blockquote.exec(e);if(t){let i=_r(t[0],`
`).split(`
`),s="",r="";const n=[];for(;i.length>0;){let o=!1;const a=[];let c;for(c=0;c<i.length;c++)if(this.rules.other.blockquoteStart.test(i[c]))a.push(i[c]),o=!0;else if(!o)a.push(i[c]);else break;i=i.slice(c);const d=a.join(`
`),l=d.replace(this.rules.other.blockquoteSetextReplace,`
    $1`).replace(this.rules.other.blockquoteSetextReplace2,"");s=s?`${s}
${d}`:d,r=r?`${r}
${l}`:l;const u=this.lexer.state.top;if(this.lexer.state.top=!0,this.lexer.blockTokens(l,n,!0),this.lexer.state.top=u,i.length===0)break;const p=n.at(-1);if((p==null?void 0:p.type)==="code")break;if((p==null?void 0:p.type)==="blockquote"){const h=p,g=h.raw+`
`+i.join(`
`),f=this.blockquote(g);n[n.length-1]=f,s=s.substring(0,s.length-h.raw.length)+f.raw,r=r.substring(0,r.length-h.text.length)+f.text;break}else if((p==null?void 0:p.type)==="list"){const h=p,g=h.raw+`
`+i.join(`
`),f=this.list(g);n[n.length-1]=f,s=s.substring(0,s.length-p.raw.length)+f.raw,r=r.substring(0,r.length-h.raw.length)+f.raw,i=g.substring(n.at(-1).raw.length).split(`
`);continue}}return{type:"blockquote",raw:s,tokens:n,text:r}}}list(e){let t=this.rules.block.list.exec(e);if(t){let i=t[1].trim();const s=i.length>1,r={type:"list",raw:"",ordered:s,start:s?+i.slice(0,-1):"",loose:!1,items:[]};i=s?`\\d{1,9}\\${i.slice(-1)}`:`\\${i}`,this.options.pedantic&&(i=s?i:"[*+-]");const n=this.rules.other.listItemRegex(i);let o=!1;for(;e;){let c=!1,d="",l="";if(!(t=n.exec(e))||this.rules.block.hr.test(e))break;d=t[0],e=e.substring(d.length);let u=t[2].split(`
`,1)[0].replace(this.rules.other.listReplaceTabs,b=>" ".repeat(3*b.length)),p=e.split(`
`,1)[0],h=!u.trim(),g=0;if(this.options.pedantic?(g=2,l=u.trimStart()):h?g=t[1].length+1:(g=t[2].search(this.rules.other.nonSpaceChar),g=g>4?1:g,l=u.slice(g),g+=t[1].length),h&&this.rules.other.blankLine.test(p)&&(d+=p+`
`,e=e.substring(p.length+1),c=!0),!c){const b=this.rules.other.nextBulletRegex(g),v=this.rules.other.hrRegex(g),y=this.rules.other.fencesBeginRegex(g),w=this.rules.other.headingBeginRegex(g),C=this.rules.other.htmlBeginRegex(g);for(;e;){const O=e.split(`
`,1)[0];let M;if(p=O,this.options.pedantic?(p=p.replace(this.rules.other.listReplaceNesting,"  "),M=p):M=p.replace(this.rules.other.tabCharGlobal,"    "),y.test(p)||w.test(p)||C.test(p)||b.test(p)||v.test(p))break;if(M.search(this.rules.other.nonSpaceChar)>=g||!p.trim())l+=`
`+M.slice(g);else{if(h||u.replace(this.rules.other.tabCharGlobal,"    ").search(this.rules.other.nonSpaceChar)>=4||y.test(u)||w.test(u)||v.test(u))break;l+=`
`+p}!h&&!p.trim()&&(h=!0),d+=O+`
`,e=e.substring(O.length+1),u=M.slice(g)}}r.loose||(o?r.loose=!0:this.rules.other.doubleBlankLine.test(d)&&(o=!0));let f=null,m;this.options.gfm&&(f=this.rules.other.listIsTask.exec(l),f&&(m=f[0]!=="[ ] ",l=l.replace(this.rules.other.listReplaceTask,""))),r.items.push({type:"list_item",raw:d,task:!!f,checked:m,loose:!1,text:l,tokens:[]}),r.raw+=d}const a=r.items.at(-1);if(a)a.raw=a.raw.trimEnd(),a.text=a.text.trimEnd();else return;r.raw=r.raw.trimEnd();for(let c=0;c<r.items.length;c++)if(this.lexer.state.top=!1,r.items[c].tokens=this.lexer.blockTokens(r.items[c].text,[]),!r.loose){const d=r.items[c].tokens.filter(u=>u.type==="space"),l=d.length>0&&d.some(u=>this.rules.other.anyLine.test(u.raw));r.loose=l}if(r.loose)for(let c=0;c<r.items.length;c++)r.items[c].loose=!0;return r}}html(e){const t=this.rules.block.html.exec(e);if(t)return{type:"html",block:!0,raw:t[0],pre:t[1]==="pre"||t[1]==="script"||t[1]==="style",text:t[0]}}def(e){const t=this.rules.block.def.exec(e);if(t){const i=t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal," "),s=t[2]?t[2].replace(this.rules.other.hrefBrackets,"$1").replace(this.rules.inline.anyPunctuation,"$1"):"",r=t[3]?t[3].substring(1,t[3].length-1).replace(this.rules.inline.anyPunctuation,"$1"):t[3];return{type:"def",tag:i,raw:t[0],href:s,title:r}}}table(e){var o;const t=this.rules.block.table.exec(e);if(!t||!this.rules.other.tableDelimiter.test(t[2]))return;const i=Eu(t[1]),s=t[2].replace(this.rules.other.tableAlignChars,"").split("|"),r=(o=t[3])!=null&&o.trim()?t[3].replace(this.rules.other.tableRowBlankLine,"").split(`
`):[],n={type:"table",raw:t[0],header:[],align:[],rows:[]};if(i.length===s.length){for(const a of s)this.rules.other.tableAlignRight.test(a)?n.align.push("right"):this.rules.other.tableAlignCenter.test(a)?n.align.push("center"):this.rules.other.tableAlignLeft.test(a)?n.align.push("left"):n.align.push(null);for(let a=0;a<i.length;a++)n.header.push({text:i[a],tokens:this.lexer.inline(i[a]),header:!0,align:n.align[a]});for(const a of r)n.rows.push(Eu(a,n.header.length).map((c,d)=>({text:c,tokens:this.lexer.inline(c),header:!1,align:n.align[d]})));return n}}lheading(e){const t=this.rules.block.lheading.exec(e);if(t)return{type:"heading",raw:t[0],depth:t[2].charAt(0)==="="?1:2,text:t[1],tokens:this.lexer.inline(t[1])}}paragraph(e){const t=this.rules.block.paragraph.exec(e);if(t){const i=t[1].charAt(t[1].length-1)===`
`?t[1].slice(0,-1):t[1];return{type:"paragraph",raw:t[0],text:i,tokens:this.lexer.inline(i)}}}text(e){const t=this.rules.block.text.exec(e);if(t)return{type:"text",raw:t[0],text:t[0],tokens:this.lexer.inline(t[0])}}escape(e){const t=this.rules.inline.escape.exec(e);if(t)return{type:"escape",raw:t[0],text:t[1]}}tag(e){const t=this.rules.inline.tag.exec(e);if(t)return!this.lexer.state.inLink&&this.rules.other.startATag.test(t[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&this.rules.other.endATag.test(t[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&this.rules.other.startPreScriptTag.test(t[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&this.rules.other.endPreScriptTag.test(t[0])&&(this.lexer.state.inRawBlock=!1),{type:"html",raw:t[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:t[0]}}link(e){const t=this.rules.inline.link.exec(e);if(t){const i=t[2].trim();if(!this.options.pedantic&&this.rules.other.startAngleBracket.test(i)){if(!this.rules.other.endAngleBracket.test(i))return;const n=_r(i.slice(0,-1),"\\");if((i.length-n.length)%2===0)return}else{const n=Yy(t[2],"()");if(n===-2)return;if(n>-1){const a=(t[0].indexOf("!")===0?5:4)+t[1].length+n;t[2]=t[2].substring(0,n),t[0]=t[0].substring(0,a).trim(),t[3]=""}}let s=t[2],r="";if(this.options.pedantic){const n=this.rules.other.pedanticHrefTitle.exec(s);n&&(s=n[1],r=n[3])}else r=t[3]?t[3].slice(1,-1):"";return s=s.trim(),this.rules.other.startAngleBracket.test(s)&&(this.options.pedantic&&!this.rules.other.endAngleBracket.test(i)?s=s.slice(1):s=s.slice(1,-1)),xu(t,{href:s&&s.replace(this.rules.inline.anyPunctuation,"$1"),title:r&&r.replace(this.rules.inline.anyPunctuation,"$1")},t[0],this.lexer,this.rules)}}reflink(e,t){let i;if((i=this.rules.inline.reflink.exec(e))||(i=this.rules.inline.nolink.exec(e))){const s=(i[2]||i[1]).replace(this.rules.other.multipleSpaceGlobal," "),r=t[s.toLowerCase()];if(!r){const n=i[0].charAt(0);return{type:"text",raw:n,text:n}}return xu(i,r,i[0],this.lexer,this.rules)}}emStrong(e,t,i=""){let s=this.rules.inline.emStrongLDelim.exec(e);if(!s||s[3]&&i.match(this.rules.other.unicodeAlphaNumeric))return;if(!(s[1]||s[2]||"")||!i||this.rules.inline.punctuation.exec(i)){const n=[...s[0]].length-1;let o,a,c=n,d=0;const l=s[0][0]==="*"?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(l.lastIndex=0,t=t.slice(-1*e.length+n);(s=l.exec(t))!=null;){if(o=s[1]||s[2]||s[3]||s[4]||s[5]||s[6],!o)continue;if(a=[...o].length,s[3]||s[4]){c+=a;continue}else if((s[5]||s[6])&&n%3&&!((n+a)%3)){d+=a;continue}if(c-=a,c>0)continue;a=Math.min(a,a+c+d);const u=[...s[0]][0].length,p=e.slice(0,n+s.index+u+a);if(Math.min(n,a)%2){const g=p.slice(1,-1);return{type:"em",raw:p,text:g,tokens:this.lexer.inlineTokens(g)}}const h=p.slice(2,-2);return{type:"strong",raw:p,text:h,tokens:this.lexer.inlineTokens(h)}}}}codespan(e){const t=this.rules.inline.code.exec(e);if(t){let i=t[2].replace(this.rules.other.newLineCharGlobal," ");const s=this.rules.other.nonSpaceChar.test(i),r=this.rules.other.startingSpaceChar.test(i)&&this.rules.other.endingSpaceChar.test(i);return s&&r&&(i=i.substring(1,i.length-1)),{type:"codespan",raw:t[0],text:i}}}br(e){const t=this.rules.inline.br.exec(e);if(t)return{type:"br",raw:t[0]}}del(e){const t=this.rules.inline.del.exec(e);if(t)return{type:"del",raw:t[0],text:t[2],tokens:this.lexer.inlineTokens(t[2])}}autolink(e){const t=this.rules.inline.autolink.exec(e);if(t){let i,s;return t[2]==="@"?(i=t[1],s="mailto:"+i):(i=t[1],s=i),{type:"link",raw:t[0],text:i,href:s,tokens:[{type:"text",raw:i,text:i}]}}}url(e){var i;let t;if(t=this.rules.inline.url.exec(e)){let s,r;if(t[2]==="@")s=t[0],r="mailto:"+s;else{let n;do n=t[0],t[0]=((i=this.rules.inline._backpedal.exec(t[0]))==null?void 0:i[0])??"";while(n!==t[0]);s=t[0],t[1]==="www."?r="http://"+t[0]:r=t[0]}return{type:"link",raw:t[0],text:s,href:r,tokens:[{type:"text",raw:s,text:s}]}}}inlineText(e){const t=this.rules.inline.text.exec(e);if(t){const i=this.lexer.state.inRawBlock;return{type:"text",raw:t[0],text:t[0],escaped:i}}}},Mi=class Fl{constructor(t){he(this,"tokens");he(this,"options");he(this,"state");he(this,"tokenizer");he(this,"inlineQueue");this.tokens=[],this.tokens.links=Object.create(null),this.options=t||$s,this.options.tokenizer=this.options.tokenizer||new Fn,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};const i={other:St,block:pn.normal,inline:wr.normal};this.options.pedantic?(i.block=pn.pedantic,i.inline=wr.pedantic):this.options.gfm&&(i.block=pn.gfm,this.options.breaks?i.inline=wr.breaks:i.inline=wr.gfm),this.tokenizer.rules=i}static get rules(){return{block:pn,inline:wr}}static lex(t,i){return new Fl(i).lex(t)}static lexInline(t,i){return new Fl(i).inlineTokens(t)}lex(t){t=t.replace(St.carriageReturn,`
`),this.blockTokens(t,this.tokens);for(let i=0;i<this.inlineQueue.length;i++){const s=this.inlineQueue[i];this.inlineTokens(s.src,s.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(t,i=[],s=!1){var r,n,o;for(this.options.pedantic&&(t=t.replace(St.tabCharGlobal,"    ").replace(St.spaceLine,""));t;){let a;if((n=(r=this.options.extensions)==null?void 0:r.block)!=null&&n.some(d=>(a=d.call({lexer:this},t,i))?(t=t.substring(a.raw.length),i.push(a),!0):!1))continue;if(a=this.tokenizer.space(t)){t=t.substring(a.raw.length);const d=i.at(-1);a.raw.length===1&&d!==void 0?d.raw+=`
`:i.push(a);continue}if(a=this.tokenizer.code(t)){t=t.substring(a.raw.length);const d=i.at(-1);(d==null?void 0:d.type)==="paragraph"||(d==null?void 0:d.type)==="text"?(d.raw+=`
`+a.raw,d.text+=`
`+a.text,this.inlineQueue.at(-1).src=d.text):i.push(a);continue}if(a=this.tokenizer.fences(t)){t=t.substring(a.raw.length),i.push(a);continue}if(a=this.tokenizer.heading(t)){t=t.substring(a.raw.length),i.push(a);continue}if(a=this.tokenizer.hr(t)){t=t.substring(a.raw.length),i.push(a);continue}if(a=this.tokenizer.blockquote(t)){t=t.substring(a.raw.length),i.push(a);continue}if(a=this.tokenizer.list(t)){t=t.substring(a.raw.length),i.push(a);continue}if(a=this.tokenizer.html(t)){t=t.substring(a.raw.length),i.push(a);continue}if(a=this.tokenizer.def(t)){t=t.substring(a.raw.length);const d=i.at(-1);(d==null?void 0:d.type)==="paragraph"||(d==null?void 0:d.type)==="text"?(d.raw+=`
`+a.raw,d.text+=`
`+a.raw,this.inlineQueue.at(-1).src=d.text):this.tokens.links[a.tag]||(this.tokens.links[a.tag]={href:a.href,title:a.title});continue}if(a=this.tokenizer.table(t)){t=t.substring(a.raw.length),i.push(a);continue}if(a=this.tokenizer.lheading(t)){t=t.substring(a.raw.length),i.push(a);continue}let c=t;if((o=this.options.extensions)!=null&&o.startBlock){let d=1/0;const l=t.slice(1);let u;this.options.extensions.startBlock.forEach(p=>{u=p.call({lexer:this},l),typeof u=="number"&&u>=0&&(d=Math.min(d,u))}),d<1/0&&d>=0&&(c=t.substring(0,d+1))}if(this.state.top&&(a=this.tokenizer.paragraph(c))){const d=i.at(-1);s&&(d==null?void 0:d.type)==="paragraph"?(d.raw+=`
`+a.raw,d.text+=`
`+a.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=d.text):i.push(a),s=c.length!==t.length,t=t.substring(a.raw.length);continue}if(a=this.tokenizer.text(t)){t=t.substring(a.raw.length);const d=i.at(-1);(d==null?void 0:d.type)==="text"?(d.raw+=`
`+a.raw,d.text+=`
`+a.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=d.text):i.push(a);continue}if(t){const d="Infinite loop on byte: "+t.charCodeAt(0);if(this.options.silent){console.error(d);break}else throw new Error(d)}}return this.state.top=!0,i}inline(t,i=[]){return this.inlineQueue.push({src:t,tokens:i}),i}inlineTokens(t,i=[]){var a,c,d;let s=t,r=null;if(this.tokens.links){const l=Object.keys(this.tokens.links);if(l.length>0)for(;(r=this.tokenizer.rules.inline.reflinkSearch.exec(s))!=null;)l.includes(r[0].slice(r[0].lastIndexOf("[")+1,-1))&&(s=s.slice(0,r.index)+"["+"a".repeat(r[0].length-2)+"]"+s.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;(r=this.tokenizer.rules.inline.anyPunctuation.exec(s))!=null;)s=s.slice(0,r.index)+"++"+s.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);for(;(r=this.tokenizer.rules.inline.blockSkip.exec(s))!=null;)s=s.slice(0,r.index)+"["+"a".repeat(r[0].length-2)+"]"+s.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);let n=!1,o="";for(;t;){n||(o=""),n=!1;let l;if((c=(a=this.options.extensions)==null?void 0:a.inline)!=null&&c.some(p=>(l=p.call({lexer:this},t,i))?(t=t.substring(l.raw.length),i.push(l),!0):!1))continue;if(l=this.tokenizer.escape(t)){t=t.substring(l.raw.length),i.push(l);continue}if(l=this.tokenizer.tag(t)){t=t.substring(l.raw.length),i.push(l);continue}if(l=this.tokenizer.link(t)){t=t.substring(l.raw.length),i.push(l);continue}if(l=this.tokenizer.reflink(t,this.tokens.links)){t=t.substring(l.raw.length);const p=i.at(-1);l.type==="text"&&(p==null?void 0:p.type)==="text"?(p.raw+=l.raw,p.text+=l.text):i.push(l);continue}if(l=this.tokenizer.emStrong(t,s,o)){t=t.substring(l.raw.length),i.push(l);continue}if(l=this.tokenizer.codespan(t)){t=t.substring(l.raw.length),i.push(l);continue}if(l=this.tokenizer.br(t)){t=t.substring(l.raw.length),i.push(l);continue}if(l=this.tokenizer.del(t)){t=t.substring(l.raw.length),i.push(l);continue}if(l=this.tokenizer.autolink(t)){t=t.substring(l.raw.length),i.push(l);continue}if(!this.state.inLink&&(l=this.tokenizer.url(t))){t=t.substring(l.raw.length),i.push(l);continue}let u=t;if((d=this.options.extensions)!=null&&d.startInline){let p=1/0;const h=t.slice(1);let g;this.options.extensions.startInline.forEach(f=>{g=f.call({lexer:this},h),typeof g=="number"&&g>=0&&(p=Math.min(p,g))}),p<1/0&&p>=0&&(u=t.substring(0,p+1))}if(l=this.tokenizer.inlineText(u)){t=t.substring(l.raw.length),l.raw.slice(-1)!=="_"&&(o=l.raw.slice(-1)),n=!0;const p=i.at(-1);(p==null?void 0:p.type)==="text"?(p.raw+=l.raw,p.text+=l.text):i.push(l);continue}if(t){const p="Infinite loop on byte: "+t.charCodeAt(0);if(this.options.silent){console.error(p);break}else throw new Error(p)}}return i}},zn=class{constructor(e){he(this,"options");he(this,"parser");this.options=e||$s}space(e){return""}code({text:e,lang:t,escaped:i}){var n;const s=(n=(t||"").match(St.notSpaceStart))==null?void 0:n[0],r=e.replace(St.endingNewline,"")+`
`;return s?'<pre><code class="language-'+yi(s)+'">'+(i?r:yi(r,!0))+`</code></pre>
`:"<pre><code>"+(i?r:yi(r,!0))+`</code></pre>
`}blockquote({tokens:e}){return`<blockquote>
${this.parser.parse(e)}</blockquote>
`}html({text:e}){return e}heading({tokens:e,depth:t}){return`<h${t}>${this.parser.parseInline(e)}</h${t}>
`}hr(e){return`<hr>
`}list(e){const t=e.ordered,i=e.start;let s="";for(let o=0;o<e.items.length;o++){const a=e.items[o];s+=this.listitem(a)}const r=t?"ol":"ul",n=t&&i!==1?' start="'+i+'"':"";return"<"+r+n+`>
`+s+"</"+r+`>
`}listitem(e){var i;let t="";if(e.task){const s=this.checkbox({checked:!!e.checked});e.loose?((i=e.tokens[0])==null?void 0:i.type)==="paragraph"?(e.tokens[0].text=s+" "+e.tokens[0].text,e.tokens[0].tokens&&e.tokens[0].tokens.length>0&&e.tokens[0].tokens[0].type==="text"&&(e.tokens[0].tokens[0].text=s+" "+yi(e.tokens[0].tokens[0].text),e.tokens[0].tokens[0].escaped=!0)):e.tokens.unshift({type:"text",raw:s+" ",text:s+" ",escaped:!0}):t+=s+" "}return t+=this.parser.parse(e.tokens,!!e.loose),`<li>${t}</li>
`}checkbox({checked:e}){return"<input "+(e?'checked="" ':"")+'disabled="" type="checkbox">'}paragraph({tokens:e}){return`<p>${this.parser.parseInline(e)}</p>
`}table(e){let t="",i="";for(let r=0;r<e.header.length;r++)i+=this.tablecell(e.header[r]);t+=this.tablerow({text:i});let s="";for(let r=0;r<e.rows.length;r++){const n=e.rows[r];i="";for(let o=0;o<n.length;o++)i+=this.tablecell(n[o]);s+=this.tablerow({text:i})}return s&&(s=`<tbody>${s}</tbody>`),`<table>
<thead>
`+t+`</thead>
`+s+`</table>
`}tablerow({text:e}){return`<tr>
${e}</tr>
`}tablecell(e){const t=this.parser.parseInline(e.tokens),i=e.header?"th":"td";return(e.align?`<${i} align="${e.align}">`:`<${i}>`)+t+`</${i}>
`}strong({tokens:e}){return`<strong>${this.parser.parseInline(e)}</strong>`}em({tokens:e}){return`<em>${this.parser.parseInline(e)}</em>`}codespan({text:e}){return`<code>${yi(e,!0)}</code>`}br(e){return"<br>"}del({tokens:e}){return`<del>${this.parser.parseInline(e)}</del>`}link({href:e,title:t,tokens:i}){const s=this.parser.parseInline(i),r=ku(e);if(r===null)return s;e=r;let n='<a href="'+e+'"';return t&&(n+=' title="'+yi(t)+'"'),n+=">"+s+"</a>",n}image({href:e,title:t,text:i,tokens:s}){s&&(i=this.parser.parseInline(s,this.parser.textRenderer));const r=ku(e);if(r===null)return yi(i);e=r;let n=`<img src="${e}" alt="${i}"`;return t&&(n+=` title="${yi(t)}"`),n+=">",n}text(e){return"tokens"in e&&e.tokens?this.parser.parseInline(e.tokens):"escaped"in e&&e.escaped?e.text:yi(e.text)}},bc=class{strong({text:e}){return e}em({text:e}){return e}codespan({text:e}){return e}del({text:e}){return e}html({text:e}){return e}text({text:e}){return e}link({text:e}){return""+e}image({text:e}){return""+e}br(){return""}},Fi=class zl{constructor(t){he(this,"options");he(this,"renderer");he(this,"textRenderer");this.options=t||$s,this.options.renderer=this.options.renderer||new zn,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new bc}static parse(t,i){return new zl(i).parse(t)}static parseInline(t,i){return new zl(i).parseInline(t)}parse(t,i=!0){var r,n;let s="";for(let o=0;o<t.length;o++){const a=t[o];if((n=(r=this.options.extensions)==null?void 0:r.renderers)!=null&&n[a.type]){const d=a,l=this.options.extensions.renderers[d.type].call({parser:this},d);if(l!==!1||!["space","hr","heading","code","table","blockquote","list","html","paragraph","text"].includes(d.type)){s+=l||"";continue}}const c=a;switch(c.type){case"space":{s+=this.renderer.space(c);continue}case"hr":{s+=this.renderer.hr(c);continue}case"heading":{s+=this.renderer.heading(c);continue}case"code":{s+=this.renderer.code(c);continue}case"table":{s+=this.renderer.table(c);continue}case"blockquote":{s+=this.renderer.blockquote(c);continue}case"list":{s+=this.renderer.list(c);continue}case"html":{s+=this.renderer.html(c);continue}case"paragraph":{s+=this.renderer.paragraph(c);continue}case"text":{let d=c,l=this.renderer.text(d);for(;o+1<t.length&&t[o+1].type==="text";)d=t[++o],l+=`
`+this.renderer.text(d);i?s+=this.renderer.paragraph({type:"paragraph",raw:l,text:l,tokens:[{type:"text",raw:l,text:l,escaped:!0}]}):s+=l;continue}default:{const d='Token with "'+c.type+'" type was not found.';if(this.options.silent)return console.error(d),"";throw new Error(d)}}}return s}parseInline(t,i=this.renderer){var r,n;let s="";for(let o=0;o<t.length;o++){const a=t[o];if((n=(r=this.options.extensions)==null?void 0:r.renderers)!=null&&n[a.type]){const d=this.options.extensions.renderers[a.type].call({parser:this},a);if(d!==!1||!["escape","html","link","image","strong","em","codespan","br","del","text"].includes(a.type)){s+=d||"";continue}}const c=a;switch(c.type){case"escape":{s+=i.text(c);break}case"html":{s+=i.html(c);break}case"link":{s+=i.link(c);break}case"image":{s+=i.image(c);break}case"strong":{s+=i.strong(c);break}case"em":{s+=i.em(c);break}case"codespan":{s+=i.codespan(c);break}case"br":{s+=i.br(c);break}case"del":{s+=i.del(c);break}case"text":{s+=i.text(c);break}default:{const d='Token with "'+c.type+'" type was not found.';if(this.options.silent)return console.error(d),"";throw new Error(d)}}}return s}},xl,xn=(xl=class{constructor(e){he(this,"options");he(this,"block");this.options=e||$s}preprocess(e){return e}postprocess(e){return e}processAllTokens(e){return e}provideLexer(){return this.block?Mi.lex:Mi.lexInline}provideParser(){return this.block?Fi.parse:Fi.parseInline}},he(xl,"passThroughHooks",new Set(["preprocess","postprocess","processAllTokens"])),xl),Up=class{constructor(...e){he(this,"defaults",cc());he(this,"options",this.setOptions);he(this,"parse",this.parseMarkdown(!0));he(this,"parseInline",this.parseMarkdown(!1));he(this,"Parser",Fi);he(this,"Renderer",zn);he(this,"TextRenderer",bc);he(this,"Lexer",Mi);he(this,"Tokenizer",Fn);he(this,"Hooks",xn);this.use(...e)}walkTokens(e,t){var s,r;let i=[];for(const n of e)switch(i=i.concat(t.call(this,n)),n.type){case"table":{const o=n;for(const a of o.header)i=i.concat(this.walkTokens(a.tokens,t));for(const a of o.rows)for(const c of a)i=i.concat(this.walkTokens(c.tokens,t));break}case"list":{const o=n;i=i.concat(this.walkTokens(o.items,t));break}default:{const o=n;(r=(s=this.defaults.extensions)==null?void 0:s.childTokens)!=null&&r[o.type]?this.defaults.extensions.childTokens[o.type].forEach(a=>{const c=o[a].flat(1/0);i=i.concat(this.walkTokens(c,t))}):o.tokens&&(i=i.concat(this.walkTokens(o.tokens,t)))}}return i}use(...e){const t=this.defaults.extensions||{renderers:{},childTokens:{}};return e.forEach(i=>{const s={...i};if(s.async=this.defaults.async||s.async||!1,i.extensions&&(i.extensions.forEach(r=>{if(!r.name)throw new Error("extension name required");if("renderer"in r){const n=t.renderers[r.name];n?t.renderers[r.name]=function(...o){let a=r.renderer.apply(this,o);return a===!1&&(a=n.apply(this,o)),a}:t.renderers[r.name]=r.renderer}if("tokenizer"in r){if(!r.level||r.level!=="block"&&r.level!=="inline")throw new Error("extension level must be 'block' or 'inline'");const n=t[r.level];n?n.unshift(r.tokenizer):t[r.level]=[r.tokenizer],r.start&&(r.level==="block"?t.startBlock?t.startBlock.push(r.start):t.startBlock=[r.start]:r.level==="inline"&&(t.startInline?t.startInline.push(r.start):t.startInline=[r.start]))}"childTokens"in r&&r.childTokens&&(t.childTokens[r.name]=r.childTokens)}),s.extensions=t),i.renderer){const r=this.defaults.renderer||new zn(this.defaults);for(const n in i.renderer){if(!(n in r))throw new Error(`renderer '${n}' does not exist`);if(["options","parser"].includes(n))continue;const o=n,a=i.renderer[o],c=r[o];r[o]=(...d)=>{let l=a.apply(r,d);return l===!1&&(l=c.apply(r,d)),l||""}}s.renderer=r}if(i.tokenizer){const r=this.defaults.tokenizer||new Fn(this.defaults);for(const n in i.tokenizer){if(!(n in r))throw new Error(`tokenizer '${n}' does not exist`);if(["options","rules","lexer"].includes(n))continue;const o=n,a=i.tokenizer[o],c=r[o];r[o]=(...d)=>{let l=a.apply(r,d);return l===!1&&(l=c.apply(r,d)),l}}s.tokenizer=r}if(i.hooks){const r=this.defaults.hooks||new xn;for(const n in i.hooks){if(!(n in r))throw new Error(`hook '${n}' does not exist`);if(["options","block"].includes(n))continue;const o=n,a=i.hooks[o],c=r[o];xn.passThroughHooks.has(n)?r[o]=d=>{if(this.defaults.async)return Promise.resolve(a.call(r,d)).then(u=>c.call(r,u));const l=a.call(r,d);return c.call(r,l)}:r[o]=(...d)=>{let l=a.apply(r,d);return l===!1&&(l=c.apply(r,d)),l}}s.hooks=r}if(i.walkTokens){const r=this.defaults.walkTokens,n=i.walkTokens;s.walkTokens=function(o){let a=[];return a.push(n.call(this,o)),r&&(a=a.concat(r.call(this,o))),a}}this.defaults={...this.defaults,...s}}),this}setOptions(e){return this.defaults={...this.defaults,...e},this}lexer(e,t){return Mi.lex(e,t??this.defaults)}parser(e,t){return Fi.parse(e,t??this.defaults)}parseMarkdown(e){return(i,s)=>{const r={...s},n={...this.defaults,...r},o=this.onError(!!n.silent,!!n.async);if(this.defaults.async===!0&&r.async===!1)return o(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));if(typeof i>"u"||i===null)return o(new Error("marked(): input parameter is undefined or null"));if(typeof i!="string")return o(new Error("marked(): input parameter is of type "+Object.prototype.toString.call(i)+", string expected"));n.hooks&&(n.hooks.options=n,n.hooks.block=e);const a=n.hooks?n.hooks.provideLexer():e?Mi.lex:Mi.lexInline,c=n.hooks?n.hooks.provideParser():e?Fi.parse:Fi.parseInline;if(n.async)return Promise.resolve(n.hooks?n.hooks.preprocess(i):i).then(d=>a(d,n)).then(d=>n.hooks?n.hooks.processAllTokens(d):d).then(d=>n.walkTokens?Promise.all(this.walkTokens(d,n.walkTokens)).then(()=>d):d).then(d=>c(d,n)).then(d=>n.hooks?n.hooks.postprocess(d):d).catch(o);try{n.hooks&&(i=n.hooks.preprocess(i));let d=a(i,n);n.hooks&&(d=n.hooks.processAllTokens(d)),n.walkTokens&&this.walkTokens(d,n.walkTokens);let l=c(d,n);return n.hooks&&(l=n.hooks.postprocess(l)),l}catch(d){return o(d)}}}onError(e,t){return i=>{if(i.message+=`
Please report this to https://github.com/markedjs/marked.`,e){const s="<p>An error occurred:</p><pre>"+yi(i.message+"",!0)+"</pre>";return t?Promise.resolve(s):s}if(t)return Promise.reject(i);throw i}}},Ss=new Up;function Fe(e,t){return Ss.parse(e,t)}Fe.options=Fe.setOptions=function(e){return Ss.setOptions(e),Fe.defaults=Ss.defaults,Ip(Fe.defaults),Fe};Fe.getDefaults=cc;Fe.defaults=$s;Fe.use=function(...e){return Ss.use(...e),Fe.defaults=Ss.defaults,Ip(Fe.defaults),Fe};Fe.walkTokens=function(e,t){return Ss.walkTokens(e,t)};Fe.parseInline=Ss.parseInline;Fe.Parser=Fi;Fe.parser=Fi.parse;Fe.Renderer=zn;Fe.TextRenderer=bc;Fe.Lexer=Mi;Fe.lexer=Mi.lex;Fe.Tokenizer=Fn;Fe.Hooks=xn;Fe.parse=Fe;Fe.options;Fe.setOptions;Fe.use;Fe.walkTokens;Fe.parseInline;Fi.parse;Mi.lex;/*! @license DOMPurify 3.4.12 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.12/LICENSE */function Tu(e,t){(t==null||t>e.length)&&(t=e.length);for(var i=0,s=Array(t);i<t;i++)s[i]=e[i];return s}function Xy(e){if(Array.isArray(e))return e}function Jy(e,t){var i=e==null?null:typeof Symbol<"u"&&e[Symbol.iterator]||e["@@iterator"];if(i!=null){var s,r,n,o,a=[],c=!0,d=!1;try{if(n=(i=i.call(e)).next,t!==0)for(;!(c=(s=n.call(i)).done)&&(a.push(s.value),a.length!==t);c=!0);}catch(l){d=!0,r=l}finally{try{if(!c&&i.return!=null&&(o=i.return(),Object(o)!==o))return}finally{if(d)throw r}}return a}}function Zy(){throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function Qy(e,t){return Xy(e)||Jy(e,t)||e0(e,t)||Zy()}function e0(e,t){if(e){if(typeof e=="string")return Tu(e,t);var i={}.toString.call(e).slice(8,-1);return i==="Object"&&e.constructor&&(i=e.constructor.name),i==="Map"||i==="Set"?Array.from(e):i==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(i)?Tu(e,t):void 0}}const qp=Object.entries,Cu=Object.setPrototypeOf,t0=Object.isFrozen,i0=Object.getPrototypeOf,s0=Object.getOwnPropertyDescriptor;let ct=Object.freeze,ut=Object.seal,js=Object.create,Hp=typeof Reflect<"u"&&Reflect,Bl=Hp.apply,Ul=Hp.construct;ct||(ct=function(t){return t});ut||(ut=function(t){return t});Bl||(Bl=function(t,i){for(var s=arguments.length,r=new Array(s>2?s-2:0),n=2;n<s;n++)r[n-2]=arguments[n];return t.apply(i,r)});Ul||(Ul=function(t){for(var i=arguments.length,s=new Array(i>1?i-1:0),r=1;r<i;r++)s[r-1]=arguments[r];return new t(...s)});const qs=Ze(Array.prototype.forEach),r0=Ze(Array.prototype.lastIndexOf),Su=Ze(Array.prototype.pop),Hs=Ze(Array.prototype.push),n0=Ze(Array.prototype.splice),Xi=Array.isArray,Tr=Ze(String.prototype.toLowerCase),Oa=Ze(String.prototype.toString),Ou=Ze(String.prototype.match),kr=Ze(String.prototype.replace),Au=Ze(String.prototype.indexOf),o0=Ze(String.prototype.trim),a0=Ze(Number.prototype.toString),l0=Ze(Boolean.prototype.toString),Iu=typeof BigInt>"u"?null:Ze(BigInt.prototype.toString),Ru=typeof Symbol>"u"?null:Ze(Symbol.prototype.toString),nt=Ze(Object.prototype.hasOwnProperty),Er=Ze(Object.prototype.toString),rt=Ze(RegExp.prototype.test),ms=c0(TypeError);function Ze(e){return function(t){t instanceof RegExp&&(t.lastIndex=0);for(var i=arguments.length,s=new Array(i>1?i-1:0),r=1;r<i;r++)s[r-1]=arguments[r];return Bl(e,t,s)}}function c0(e){return function(){for(var t=arguments.length,i=new Array(t),s=0;s<t;s++)i[s]=arguments[s];return Ul(e,i)}}function xe(e,t){let i=arguments.length>2&&arguments[2]!==void 0?arguments[2]:Tr;if(Cu&&Cu(e,null),!Xi(t))return e;let s=t.length;for(;s--;){let r=t[s];if(typeof r=="string"){const n=i(r);n!==r&&(t0(t)||(t[s]=n),r=n)}e[r]=!0}return e}function d0(e){for(let t=0;t<e.length;t++)nt(e,t)||(e[t]=null);return e}function xt(e){const t=js(null);for(const s of qp(e)){var i=Qy(s,2);const r=i[0],n=i[1];nt(e,r)&&(Xi(n)?t[r]=d0(n):n&&typeof n=="object"&&n.constructor===Object?t[r]=xt(n):t[r]=n)}return t}function u0(e){switch(typeof e){case"string":return e;case"number":return a0(e);case"boolean":return l0(e);case"bigint":return Iu?Iu(e):"0";case"symbol":return Ru?Ru(e):"Symbol()";case"undefined":return Er(e);case"function":case"object":{if(e===null)return Er(e);const t=e,i=wi(t,"toString");if(typeof i=="function"){const s=i(t);return typeof s=="string"?s:Er(s)}return Er(e)}default:return Er(e)}}function wi(e,t){for(;e!==null;){const s=s0(e,t);if(s){if(s.get)return Ze(s.get);if(typeof s.value=="function")return Ze(s.value)}e=i0(e)}function i(){return null}return i}function h0(e){try{return rt(e,""),!0}catch{return!1}}const $u=ct(["a","abbr","acronym","address","area","article","aside","audio","b","bdi","bdo","big","blink","blockquote","body","br","button","canvas","caption","center","cite","code","col","colgroup","content","data","datalist","dd","decorator","del","details","dfn","dialog","dir","div","dl","dt","element","em","fieldset","figcaption","figure","font","footer","form","h1","h2","h3","h4","h5","h6","head","header","hgroup","hr","html","i","img","input","ins","kbd","label","legend","li","main","map","mark","marquee","menu","menuitem","meter","nav","nobr","ol","optgroup","option","output","p","picture","pre","progress","q","rp","rt","ruby","s","samp","search","section","select","shadow","slot","small","source","spacer","span","strike","strong","style","sub","summary","sup","table","tbody","td","template","textarea","tfoot","th","thead","time","tr","track","tt","u","ul","var","video","wbr"]),Aa=ct(["svg","a","altglyph","altglyphdef","altglyphitem","animatecolor","animatemotion","animatetransform","circle","clippath","defs","desc","ellipse","enterkeyhint","exportparts","filter","font","g","glyph","glyphref","hkern","image","inputmode","line","lineargradient","marker","mask","metadata","mpath","part","path","pattern","polygon","polyline","radialgradient","rect","stop","style","switch","symbol","text","textpath","title","tref","tspan","view","vkern"]),Ia=ct(["feBlend","feColorMatrix","feComponentTransfer","feComposite","feConvolveMatrix","feDiffuseLighting","feDisplacementMap","feDistantLight","feDropShadow","feFlood","feFuncA","feFuncB","feFuncG","feFuncR","feGaussianBlur","feImage","feMerge","feMergeNode","feMorphology","feOffset","fePointLight","feSpecularLighting","feSpotLight","feTile","feTurbulence"]),p0=ct(["animate","color-profile","cursor","discard","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","foreignobject","hatch","hatchpath","mesh","meshgradient","meshpatch","meshrow","missing-glyph","script","set","solidcolor","unknown","use"]),Ra=ct(["math","menclose","merror","mfenced","mfrac","mglyph","mi","mlabeledtr","mmultiscripts","mn","mo","mover","mpadded","mphantom","mroot","mrow","ms","mspace","msqrt","mstyle","msub","msup","msubsup","mtable","mtd","mtext","mtr","munder","munderover","mprescripts"]),f0=ct(["maction","maligngroup","malignmark","mlongdiv","mscarries","mscarry","msgroup","mstack","msline","msrow","semantics","annotation","annotation-xml","mprescripts","none"]),Du=ct(["#text"]),Nu=ct(["accept","action","align","alt","autocapitalize","autocomplete","autopictureinpicture","autoplay","background","bgcolor","border","capture","cellpadding","cellspacing","checked","cite","class","clear","color","cols","colspan","command","commandfor","controls","controlslist","coords","crossorigin","datetime","decoding","default","dir","disabled","disablepictureinpicture","disableremoteplayback","download","draggable","enctype","enterkeyhint","exportparts","face","for","headers","height","hidden","high","href","hreflang","id","inert","inputmode","integrity","ismap","kind","label","lang","list","loading","loop","low","max","maxlength","media","method","min","minlength","multiple","muted","name","nonce","noshade","novalidate","nowrap","open","optimum","part","pattern","placeholder","playsinline","popover","popovertarget","popovertargetaction","poster","preload","pubdate","radiogroup","readonly","rel","required","rev","reversed","role","rows","rowspan","spellcheck","scope","selected","shape","size","sizes","slot","span","srclang","start","src","srcset","step","style","summary","tabindex","title","translate","type","usemap","valign","value","width","wrap","xmlns"]),$a=ct(["accent-height","accumulate","additive","alignment-baseline","amplitude","ascent","attributename","attributetype","azimuth","basefrequency","baseline-shift","begin","bias","by","class","clip","clippathunits","clip-path","clip-rule","color","color-interpolation","color-interpolation-filters","color-profile","color-rendering","cx","cy","d","dx","dy","diffuseconstant","direction","display","divisor","dominant-baseline","dur","edgemode","elevation","end","exponent","fill","fill-opacity","fill-rule","filter","filterunits","flood-color","flood-opacity","font-family","font-size","font-size-adjust","font-stretch","font-style","font-variant","font-weight","fx","fy","g1","g2","glyph-name","glyphref","gradientunits","gradienttransform","height","href","id","image-rendering","in","in2","intercept","k","k1","k2","k3","k4","kerning","keypoints","keysplines","keytimes","lang","lengthadjust","letter-spacing","kernelmatrix","kernelunitlength","lighting-color","local","marker-end","marker-mid","marker-start","markerheight","markerunits","markerwidth","maskcontentunits","maskunits","max","mask","mask-type","media","method","mode","min","name","numoctaves","offset","operator","opacity","order","orient","orientation","origin","overflow","paint-order","path","pathlength","patterncontentunits","patterntransform","patternunits","points","preservealpha","preserveaspectratio","primitiveunits","r","rx","ry","radius","refx","refy","repeatcount","repeatdur","restart","result","rotate","scale","seed","shape-rendering","slope","specularconstant","specularexponent","spreadmethod","startoffset","stddeviation","stitchtiles","stop-color","stop-opacity","stroke-dasharray","stroke-dashoffset","stroke-linecap","stroke-linejoin","stroke-miterlimit","stroke-opacity","stroke","stroke-width","style","surfacescale","systemlanguage","tabindex","tablevalues","targetx","targety","transform","transform-origin","text-anchor","text-decoration","text-orientation","text-rendering","textlength","type","u1","u2","unicode","values","viewbox","visibility","version","vert-adv-y","vert-origin-x","vert-origin-y","width","word-spacing","wrap","writing-mode","xchannelselector","ychannelselector","x","x1","x2","xmlns","y","y1","y2","z","zoomandpan"]),Lu=ct(["accent","accentunder","align","bevelled","close","columnalign","columnlines","columnspacing","columnspan","denomalign","depth","dir","display","displaystyle","encoding","fence","frame","height","href","id","largeop","length","linethickness","lquote","lspace","mathbackground","mathcolor","mathsize","mathvariant","maxsize","minsize","movablelimits","notation","numalign","open","rowalign","rowlines","rowspacing","rowspan","rspace","rquote","scriptlevel","scriptminsize","scriptsizemultiplier","selection","separator","separators","stretchy","subscriptshift","supscriptshift","symmetric","voffset","width","xmlns"]),fn=ct(["xlink:href","xml:id","xlink:title","xml:space","xmlns:xlink"]),m0=ut(/{{[\w\W]*|^[\w\W]*}}/g),g0=ut(/<%[\w\W]*|^[\w\W]*%>/g),b0=ut(/\${[\w\W]*/g),v0=ut(/^data-[\-\w.\u00B7-\uFFFF]+$/),y0=ut(/^aria-[\-\w]+$/),Pu=ut(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i),w0=ut(/^(?:\w+script|data):/i),_0=ut(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g),k0=ut(/^html$/i),E0=ut(/^[a-z][.\w]*(-[.\w]+)+$/i),Mu=ut(/<[/\w!]/g),Fu=ut(/<[/\w]/g),x0=ut(/<\/no(script|embed|frames)/i),T0=ut(/\/>/i),Lt={element:1,attribute:2,text:3,cdataSection:4,entityReference:5,entityNode:6,processingInstruction:7,comment:8,document:9,documentType:10,documentFragment:11,notation:12},C0=function(){return typeof window>"u"?null:window},S0=function(t,i){if(typeof t!="object"||typeof t.createPolicy!="function")return null;let s=null;const r="data-tt-policy-suffix";i&&i.hasAttribute(r)&&(s=i.getAttribute(r));const n="dompurify"+(s?"#"+s:"");try{return t.createPolicy(n,{createHTML(o){return o},createScriptURL(o){return o}})}catch{return console.warn("TrustedTypes policy "+n+" could not be created."),null}},zu=function(){return{afterSanitizeAttributes:[],afterSanitizeElements:[],afterSanitizeShadowDOM:[],beforeSanitizeAttributes:[],beforeSanitizeElements:[],beforeSanitizeShadowDOM:[],uponSanitizeAttribute:[],uponSanitizeElement:[],uponSanitizeShadowNode:[]}},Yi=function(t,i,s,r){return nt(t,i)&&Xi(t[i])?xe(r.base?xt(r.base):{},t[i],r.transform):s};function Vp(){let e=arguments.length>0&&arguments[0]!==void 0?arguments[0]:C0();const t=J=>Vp(J);if(t.version="3.4.12",t.removed=[],!e||!e.document||e.document.nodeType!==Lt.document||!e.Element)return t.isSupported=!1,t;let i=e.document;const s=i,r=s.currentScript;e.DocumentFragment;const n=e.HTMLTemplateElement,o=e.Node,a=e.Element,c=e.NodeFilter,d=e.NamedNodeMap;d===void 0&&(e.NamedNodeMap||e.MozNamedAttrMap),e.HTMLFormElement;const l=e.DOMParser,u=e.trustedTypes,p=a.prototype,h=wi(p,"cloneNode"),g=wi(p,"remove"),f=wi(p,"nextSibling"),m=wi(p,"childNodes"),b=wi(p,"parentNode"),v=wi(p,"shadowRoot"),y=wi(p,"attributes"),w=o&&o.prototype?wi(o.prototype,"nodeType"):null,C=o&&o.prototype?wi(o.prototype,"nodeName"):null;if(typeof n=="function"){const J=i.createElement("template");J.content&&J.content.ownerDocument&&(i=J.content.ownerDocument)}let O,M="",A,R=!1,D=0;const F=function(){if(D>0)throw ms('A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the "DOMPurify and Trusted Types" section of the README.')},P=function(x){F(),D++;try{return O.createHTML(x)}finally{D--}},S=function(x){F(),D++;try{return O.createScriptURL(x)}finally{D--}},I=function(){return R||(A=S0(u,r),R=!0),A},_=i,$=_.implementation,Y=_.createNodeIterator,ie=_.createDocumentFragment,oe=_.getElementsByTagName,_e=s.importNode;let ae=zu();t.isSupported=typeof qp=="function"&&typeof b=="function"&&$&&$.createHTMLDocument!==void 0;const de=m0,N=g0,z=b0,H=v0,K=y0,ce=w0,X=_0,Se=E0;let Qe=Pu,$e=null;const lt=xe({},[...$u,...Aa,...Ia,...Ra,...Du]);let ge=null;const pi=xe({},[...Nu,...$a,...Lu,...fn]);let Be=Object.seal(js(null,{tagNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},allowCustomizedBuiltInElements:{writable:!0,configurable:!1,enumerable:!0,value:!1}})),fi=null,en=null;const Nt=Object.seal(js(null,{tagCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeCheck:{writable:!0,configurable:!1,enumerable:!0,value:null}}));let It=!0,ji=!0,_t=!1,tn=!0,mi=!1,gi=!0,bi=!1,dr=!1,kt=null,Ps=null,us=!1,Gi=!1,Ni=!1,Ms=!1,sn=!0,rn=!1;const et="user-content-";let q=!0,B=!1,G={},V=null;const se=xe({},["annotation-xml","audio","colgroup","desc","foreignobject","head","iframe","math","mi","mn","mo","ms","mtext","noembed","noframes","noscript","plaintext","script","selectedcontent","style","svg","template","thead","title","video","xmp"]);let re=null;const Re=xe({},["audio","video","img","source","image","track"]);let ve=null;const Ne=xe({},["alt","class","for","id","label","name","pattern","placeholder","role","summary","title","value","style","xmlns"]),tt="http://www.w3.org/1998/Math/MathML",Xe="http://www.w3.org/2000/svg",it="http://www.w3.org/1999/xhtml";let Fs=it,po=!1,fo=null;const cf=xe({},[tt,Xe,it],Oa),Sc=ct(["mi","mo","mn","ms","mtext"]);let mo=xe({},Sc);const Oc=ct(["annotation-xml"]);let go=xe({},Oc);const df=xe({},["title","style","font","a","script"]);let ur=null;const uf=["application/xhtml+xml","text/html"],hf="text/html";let We=null,zs=null;const pf=i.createElement("form"),Ac=function(x){return x instanceof RegExp||x instanceof Function},bo=function(){let x=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};if(zs&&zs===x)return;(!x||typeof x!="object")&&(x={}),x=xt(x),ur=uf.indexOf(x.PARSER_MEDIA_TYPE)===-1?hf:x.PARSER_MEDIA_TYPE,We=ur==="application/xhtml+xml"?Oa:Tr,$e=Yi(x,"ALLOWED_TAGS",lt,{transform:We}),ge=Yi(x,"ALLOWED_ATTR",pi,{transform:We}),fo=Yi(x,"ALLOWED_NAMESPACES",cf,{transform:Oa}),ve=Yi(x,"ADD_URI_SAFE_ATTR",Ne,{transform:We,base:Ne}),re=Yi(x,"ADD_DATA_URI_TAGS",Re,{transform:We,base:Re}),V=Yi(x,"FORBID_CONTENTS",se,{transform:We}),fi=Yi(x,"FORBID_TAGS",xt({}),{transform:We}),en=Yi(x,"FORBID_ATTR",xt({}),{transform:We}),G=nt(x,"USE_PROFILES")?x.USE_PROFILES&&typeof x.USE_PROFILES=="object"?xt(x.USE_PROFILES):x.USE_PROFILES:!1,It=x.ALLOW_ARIA_ATTR!==!1,ji=x.ALLOW_DATA_ATTR!==!1,_t=x.ALLOW_UNKNOWN_PROTOCOLS||!1,tn=x.ALLOW_SELF_CLOSE_IN_ATTR!==!1,mi=x.SAFE_FOR_TEMPLATES||!1,gi=x.SAFE_FOR_XML!==!1,bi=x.WHOLE_DOCUMENT||!1,Gi=x.RETURN_DOM||!1,Ni=x.RETURN_DOM_FRAGMENT||!1,Ms=x.RETURN_TRUSTED_TYPE||!1,us=x.FORCE_BODY||!1,sn=x.SANITIZE_DOM!==!1,rn=x.SANITIZE_NAMED_PROPS||!1,q=x.KEEP_CONTENT!==!1,B=x.IN_PLACE||!1,Qe=h0(x.ALLOWED_URI_REGEXP)?x.ALLOWED_URI_REGEXP:Pu,Fs=typeof x.NAMESPACE=="string"?x.NAMESPACE:it,mo=nt(x,"MATHML_TEXT_INTEGRATION_POINTS")&&x.MATHML_TEXT_INTEGRATION_POINTS&&typeof x.MATHML_TEXT_INTEGRATION_POINTS=="object"?xt(x.MATHML_TEXT_INTEGRATION_POINTS):xe({},Sc),go=nt(x,"HTML_INTEGRATION_POINTS")&&x.HTML_INTEGRATION_POINTS&&typeof x.HTML_INTEGRATION_POINTS=="object"?xt(x.HTML_INTEGRATION_POINTS):xe({},Oc);const L=nt(x,"CUSTOM_ELEMENT_HANDLING")&&x.CUSTOM_ELEMENT_HANDLING&&typeof x.CUSTOM_ELEMENT_HANDLING=="object"?xt(x.CUSTOM_ELEMENT_HANDLING):js(null);if(Be=js(null),nt(L,"tagNameCheck")&&Ac(L.tagNameCheck)&&(Be.tagNameCheck=L.tagNameCheck),nt(L,"attributeNameCheck")&&Ac(L.attributeNameCheck)&&(Be.attributeNameCheck=L.attributeNameCheck),nt(L,"allowCustomizedBuiltInElements")&&typeof L.allowCustomizedBuiltInElements=="boolean"&&(Be.allowCustomizedBuiltInElements=L.allowCustomizedBuiltInElements),ut(Be),mi&&(ji=!1),Ni&&(Gi=!0),G&&($e=xe({},Du),ge=js(null),G.html===!0&&(xe($e,$u),xe(ge,Nu)),G.svg===!0&&(xe($e,Aa),xe(ge,$a),xe(ge,fn)),G.svgFilters===!0&&(xe($e,Ia),xe(ge,$a),xe(ge,fn)),G.mathMl===!0&&(xe($e,Ra),xe(ge,Lu),xe(ge,fn))),Nt.tagCheck=null,Nt.attributeCheck=null,nt(x,"ADD_TAGS")&&(typeof x.ADD_TAGS=="function"?Nt.tagCheck=x.ADD_TAGS:Xi(x.ADD_TAGS)&&($e===lt&&($e=xt($e)),xe($e,x.ADD_TAGS,We))),nt(x,"ADD_ATTR")&&(typeof x.ADD_ATTR=="function"?Nt.attributeCheck=x.ADD_ATTR:Xi(x.ADD_ATTR)&&(ge===pi&&(ge=xt(ge)),xe(ge,x.ADD_ATTR,We))),nt(x,"ADD_URI_SAFE_ATTR")&&Xi(x.ADD_URI_SAFE_ATTR)&&xe(ve,x.ADD_URI_SAFE_ATTR,We),nt(x,"FORBID_CONTENTS")&&Xi(x.FORBID_CONTENTS)&&(V===se&&(V=xt(V)),xe(V,x.FORBID_CONTENTS,We)),nt(x,"ADD_FORBID_CONTENTS")&&Xi(x.ADD_FORBID_CONTENTS)&&(V===se&&(V=xt(V)),xe(V,x.ADD_FORBID_CONTENTS,We)),q&&($e["#text"]=!0),bi&&xe($e,["html","head","body"]),$e.table&&(xe($e,["tbody"]),delete fi.tbody),x.TRUSTED_TYPES_POLICY){if(typeof x.TRUSTED_TYPES_POLICY.createHTML!="function")throw ms('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');if(typeof x.TRUSTED_TYPES_POLICY.createScriptURL!="function")throw ms('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');const j=O;O=x.TRUSTED_TYPES_POLICY;try{M=P("")}catch(te){throw O=j,te}}else x.TRUSTED_TYPES_POLICY===null?(O=void 0,M=""):(O===void 0&&(O=I()),O&&typeof M=="string"&&(M=P("")));ct&&ct(x),zs=x},Ic=xe({},[...Aa,...Ia,...p0]),Rc=xe({},[...Ra,...f0]),ff=function(x,L,j){return L.namespaceURI===it?x==="svg":L.namespaceURI===tt?x==="svg"&&(j==="annotation-xml"||mo[j]):!!Ic[x]},mf=function(x,L,j){return L.namespaceURI===it?x==="math":L.namespaceURI===Xe?x==="math"&&go[j]:!!Rc[x]},gf=function(x,L,j){return L.namespaceURI===Xe&&!go[j]||L.namespaceURI===tt&&!mo[j]?!1:!Rc[x]&&(df[x]||!Ic[x])},bf=function(x){let L=b(x);(!L||!L.tagName)&&(L={namespaceURI:Fs,tagName:"template"});const j=Tr(x.tagName),te=Tr(L.tagName);return fo[x.namespaceURI]?x.namespaceURI===Xe?ff(j,L,te):x.namespaceURI===tt?mf(j,L,te):x.namespaceURI===it?gf(j,L,te):!!(ur==="application/xhtml+xml"&&fo[x.namespaceURI]):!1},Wi=function(x){Hs(t.removed,{element:x});try{b(x).removeChild(x)}catch{if(g(x),!b(x))throw ms("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place")}},nn=function(x){vo(x);const L=m(x);if(L){const te=[];qs(L,ue=>{Hs(te,ue)}),qs(te,ue=>{try{g(ue)}catch{}})}const j=y(x);if(j)for(let te=j.length-1;te>=0;--te){const ue=j[te],me=ue&&ue.name;if(typeof me=="string")try{x.removeAttribute(me)}catch{}}},hs=function(x,L){try{Hs(t.removed,{attribute:L.getAttributeNode(x),from:L})}catch{Hs(t.removed,{attribute:null,from:L})}if(L.removeAttribute(x),x==="is")if(Gi||Ni)try{Wi(L)}catch{}else try{L.setAttribute(x,"")}catch{}},vf=function(x){const L=y(x);if(L)for(let j=L.length-1;j>=0;--j){const te=L[j],ue=te&&te.name;if(!(typeof ue!="string"||ge[We(ue)]))try{x.removeAttribute(ue)}catch{}}},vo=function(x){const L=[x];for(;L.length>0;){const j=L.pop();(w?w(j):j.nodeType)===Lt.element&&vf(j);const ue=m(j);if(ue)for(let me=ue.length-1;me>=0;--me)L.push(ue[me])}},yf=function(x){if(!gi)return;const L=[x];for(;L.length>0;){const j=L.pop(),te=w?w(j):j.nodeType;if(te===Lt.processingInstruction||te===Lt.comment&&rt(Fu,j.data)){try{g(j)}catch{}continue}if(te===Lt.element){const me=j,Ye=We(C?C(j):j.nodeName);try{me.hasAttribute&&me.hasAttribute("patchsrc")&&me.removeAttribute("patchsrc"),me.hasAttribute&&me.hasAttribute("for")&&Ye!=="label"&&Ye!=="output"&&me.removeAttribute("for")}catch{}}const ue=m(j);if(ue)for(let me=ue.length-1;me>=0;--me)L.push(ue[me])}},$c=function(x){let L=null,j=null;if(us)x="<remove></remove>"+x;else{const me=Ou(x,/^[\r\n\t ]+/);j=me&&me[0]}ur==="application/xhtml+xml"&&Fs===it&&(x='<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>'+x+"</body></html>");const te=O?P(x):x;if(Fs===it)try{L=new l().parseFromString(te,ur)}catch{}if(!L||!L.documentElement){L=$.createDocument(Fs,"template",null);try{L.documentElement.innerHTML=po?M:te}catch{}}const ue=L.body||L.documentElement;return x&&j&&ue.insertBefore(i.createTextNode(j),ue.childNodes[0]||null),Fs===it?oe.call(L,bi?"html":"body")[0]:bi?L.documentElement:ue},Dc=function(x){return Y.call(x.ownerDocument||x,x,c.SHOW_ELEMENT|c.SHOW_COMMENT|c.SHOW_TEXT|c.SHOW_PROCESSING_INSTRUCTION|c.SHOW_CDATA_SECTION,null)},on=function(x){return x=kr(x,de," "),x=kr(x,N," "),x=kr(x,z," "),x},yo=function(x){var L;x.normalize();const j=Y.call(x.ownerDocument||x,x,c.SHOW_TEXT|c.SHOW_COMMENT|c.SHOW_CDATA_SECTION|c.SHOW_PROCESSING_INSTRUCTION,null);let te=j.nextNode();for(;te;)te.data=on(te.data),te=j.nextNode();const ue=(L=x.querySelectorAll)===null||L===void 0?void 0:L.call(x,"template");ue&&qs(ue,me=>{Bs(me.content)&&yo(me.content)})},an=function(x){const L=C?C(x):null;return typeof L!="string"||We(L)!=="form"?!1:typeof x.nodeName!="string"||typeof x.textContent!="string"||typeof x.removeChild!="function"||x.attributes!==y(x)||typeof x.removeAttribute!="function"||typeof x.setAttribute!="function"||typeof x.namespaceURI!="string"||typeof x.insertBefore!="function"||typeof x.hasChildNodes!="function"||x.nodeType!==w(x)||x.childNodes!==m(x)},Bs=function(x){if(!w||typeof x!="object"||x===null)return!1;try{return w(x)===Lt.documentFragment}catch{return!1}},hr=function(x){if(!w||typeof x!="object"||x===null)return!1;try{return typeof w(x)=="number"}catch{return!1}};function vi(J,x,L){J.length!==0&&qs(J,j=>{j.call(t,x,L,zs)})}const wf=function(x,L){return!!(gi&&x.hasChildNodes()&&!hr(x.firstElementChild)&&rt(Mu,x.textContent)&&rt(Mu,x.innerHTML)||gi&&x.namespaceURI===it&&L==="style"&&hr(x.firstElementChild)||x.nodeType===Lt.processingInstruction||gi&&x.nodeType===Lt.comment&&rt(Fu,x.data))},_f=function(x,L){if(!fi[L]&&Pc(L)&&(Be.tagNameCheck instanceof RegExp&&rt(Be.tagNameCheck,L)||Be.tagNameCheck instanceof Function&&Be.tagNameCheck(L)))return!1;if(q&&!V[L]){const j=b(x),te=m(x);if(te&&j){const ue=te.length;for(let me=ue-1;me>=0;--me){const Ye=B?te[me]:h(te[me],!0);j.insertBefore(Ye,f(x))}}}return Wi(x),!0},Nc=function(x,L){if(vi(ae.beforeSanitizeElements,x,null),x!==L&&b(x)===null)return!0;if(an(x))return Wi(x),!0;const j=We(C?C(x):x.nodeName);if(vi(ae.uponSanitizeElement,x,{tagName:j,allowedTags:$e}),x!==L&&b(x)===null)return!0;if(wf(x,j))return Wi(x),!0;if(fi[j]||!(Nt.tagCheck instanceof Function&&Nt.tagCheck(j))&&!$e[j]){const ue=_f(x,j);return ue===!1&&vi(ae.afterSanitizeElements,x,null),ue}if((w?w(x):x.nodeType)===Lt.element&&!bf(x)||(j==="noscript"||j==="noembed"||j==="noframes")&&rt(x0,x.innerHTML))return Wi(x),!0;if(mi&&x.nodeType===Lt.text){const ue=on(x.textContent);x.textContent!==ue&&(Hs(t.removed,{element:x.cloneNode()}),x.textContent=ue)}return vi(ae.afterSanitizeElements,x,null),!1},Lc=function(x,L,j){if(en[L]||gi&&L==="patchsrc"||gi&&L==="for"&&x!=="label"&&x!=="output"||sn&&(L==="id"||L==="name")&&(j in i||j in pf))return!1;const te=ge[L]||Nt.attributeCheck instanceof Function&&Nt.attributeCheck(L,x);if(!(ji&&rt(H,L))){if(!(It&&rt(K,L))){if(te){if(!ve[L]){if(!rt(Qe,kr(j,X,""))){if(!((L==="src"||L==="xlink:href"||L==="href")&&x!=="script"&&Au(j,"data:")===0&&re[x])){if(!(_t&&!rt(ce,kr(j,X,"")))){if(j)return!1}}}}}else if(!(Pc(x)&&(Be.tagNameCheck instanceof RegExp&&rt(Be.tagNameCheck,x)||Be.tagNameCheck instanceof Function&&Be.tagNameCheck(x))&&(Be.attributeNameCheck instanceof RegExp&&rt(Be.attributeNameCheck,L)||Be.attributeNameCheck instanceof Function&&Be.attributeNameCheck(L,x))||L==="is"&&Be.allowCustomizedBuiltInElements&&(Be.tagNameCheck instanceof RegExp&&rt(Be.tagNameCheck,j)||Be.tagNameCheck instanceof Function&&Be.tagNameCheck(j))))return!1}}return!0},kf=xe({},["annotation-xml","color-profile","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","missing-glyph"]),Pc=function(x){return!kf[Tr(x)]&&rt(Se,x)},Ef=function(x,L,j,te){if(O&&typeof u=="object"&&typeof u.getAttributeType=="function"&&!j)switch(u.getAttributeType(x,L)){case"TrustedHTML":return P(te);case"TrustedScriptURL":return S(te)}return te},xf=function(x,L,j,te){try{j?x.setAttributeNS(j,L,te):x.setAttribute(L,te),an(x)?Wi(x):Su(t.removed)}catch{hs(L,x)}},Mc=function(x){vi(ae.beforeSanitizeAttributes,x,null);const L=x.attributes;if(!L||an(x))return;const j={attrName:"",attrValue:"",keepAttr:!0,allowedAttributes:ge,forceKeepAttr:void 0};let te=L.length;const ue=We(x.nodeName);for(;te--;){const me=L[te],Ye=me.name,vt=me.namespaceURI,Zt=me.value,Rt=We(Ye),Qt=Zt;let Et=Ye==="value"?Qt:o0(Qt);if(j.attrName=Rt,j.attrValue=Et,j.keepAttr=!0,j.forceKeepAttr=void 0,vi(ae.uponSanitizeAttribute,x,j),Et=j.attrValue,rn&&(Rt==="id"||Rt==="name")&&Au(Et,et)!==0&&(hs(Ye,x),Et=et+Et),gi&&rt(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i,Et)){hs(Ye,x);continue}if(Rt==="attributename"&&Ou(Et,"href")){hs(Ye,x);continue}if(!j.forceKeepAttr){if(!j.keepAttr){hs(Ye,x);continue}if(!tn&&rt(T0,Et)){hs(Ye,x);continue}if(mi&&(Et=on(Et)),!Lc(ue,Rt,Et)){hs(Ye,x);continue}Et=Ef(ue,Rt,vt,Et),Et!==Qt&&xf(x,Ye,vt,Et)}}vi(ae.afterSanitizeAttributes,x,null)},ln=function(x){let L=null;const j=Dc(x);for(vi(ae.beforeSanitizeShadowDOM,x,null);L=j.nextNode();)if(vi(ae.uponSanitizeShadowNode,L,null),Nc(L,x),Mc(L),Bs(L.content)&&ln(L.content),(w?w(L):L.nodeType)===Lt.element){const ue=v(L);Bs(ue)&&(wo(ue),ln(ue))}vi(ae.afterSanitizeShadowDOM,x,null)},wo=function(x){const L=[{node:x,shadow:null}];for(;L.length>0;){const j=L.pop();if(j.shadow){ln(j.shadow);continue}const te=j.node,me=(w?w(te):te.nodeType)===Lt.element,Ye=m(te);if(Ye)for(let vt=Ye.length-1;vt>=0;--vt)L.push({node:Ye[vt],shadow:null});if(me){const vt=C?C(te):null;if(typeof vt=="string"&&We(vt)==="template"){const Zt=te.content;Bs(Zt)&&L.push({node:Zt,shadow:null})}}if(me){const vt=v(te);Bs(vt)&&L.push({node:null,shadow:vt},{node:vt,shadow:null})}}};return t.sanitize=function(J){let x=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},L=null,j=null,te=null,ue=null;if(po=!J,po&&(J="<!-->"),typeof J!="string"&&!hr(J)&&(J=u0(J),typeof J!="string"))throw ms("dirty is not a string, aborting");if(!t.isSupported)return J;dr?($e=kt,ge=Ps):bo(x),(ae.uponSanitizeElement.length>0||ae.uponSanitizeAttribute.length>0)&&($e=xt($e)),ae.uponSanitizeAttribute.length>0&&(ge=xt(ge)),t.removed=[];const me=B&&typeof J!="string"&&hr(J);if(me){yf(J);const Rt=C?C(J):J.nodeName;if(typeof Rt=="string"){const Qt=We(Rt);if(!$e[Qt]||fi[Qt])throw nn(J),ms("root node is forbidden and cannot be sanitized in-place")}if(an(J))throw nn(J),ms("root node is clobbered and cannot be sanitized in-place");try{wo(J)}catch(Qt){throw nn(J),Qt}}else if(hr(J))L=$c("<!---->"),j=L.ownerDocument.importNode(J,!0),j.nodeType===Lt.element&&j.nodeName==="BODY"||j.nodeName==="HTML"?L=j:L.appendChild(j),wo(j);else{if(!Gi&&!mi&&!bi&&J.indexOf("<")===-1)return O&&Ms?P(J):J;if(L=$c(J),!L)return Gi?null:Ms?M:""}L&&us&&Wi(L.firstChild);const Ye=me?J:L,vt=Dc(Ye);try{for(;te=vt.nextNode();)Nc(te,Ye),Mc(te),Bs(te.content)&&ln(te.content)}catch(Rt){throw me&&(nn(J),qs(t.removed,Qt=>{Qt.element&&vo(Qt.element)})),Rt}if(me)return qs(t.removed,Rt=>{Rt.element&&vo(Rt.element)}),mi&&yo(J),J;if(Gi){if(mi&&yo(L),Ni)for(ue=ie.call(L.ownerDocument);L.firstChild;)ue.appendChild(L.firstChild);else ue=L;return(ge.shadowroot||ge.shadowrootmode)&&(ue=_e.call(s,ue,!0)),ue}let Zt=bi?L.outerHTML:L.innerHTML;return bi&&$e["!doctype"]&&L.ownerDocument&&L.ownerDocument.doctype&&L.ownerDocument.doctype.name&&rt(k0,L.ownerDocument.doctype.name)&&(Zt="<!DOCTYPE "+L.ownerDocument.doctype.name+`>
`+Zt),mi&&(Zt=on(Zt)),O&&Ms?P(Zt):Zt},t.setConfig=function(){let J=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};bo(J),dr=!0,kt=$e,Ps=ge},t.clearConfig=function(){zs=null,dr=!1,kt=null,Ps=null,O=A,M=""},t.isValidAttribute=function(J,x,L){zs||bo({});const j=We(J),te=We(x);return Lc(j,te,L)},t.addHook=function(J,x){typeof x=="function"&&nt(ae,J)&&Hs(ae[J],x)},t.removeHook=function(J,x){if(nt(ae,J)){if(x!==void 0){const L=r0(ae[J],x);return L===-1?void 0:n0(ae[J],L,1)[0]}return Su(ae[J])}},t.removeHooks=function(J){nt(ae,J)&&(ae[J]=[])},t.removeAllHooks=function(){ae=zu()},t}var jp=Vp();const O0=Object.freeze(Object.defineProperty({__proto__:null,default:jp},Symbol.toStringTag,{value:"Module"})),A0=["form","input","button","select","textarea","option","dialog","style"],I0=["style","class","formaction","action","download","slot"],R0=new Up({renderer:{checkbox:({checked:e})=>e?'<span role="img" aria-label="Completed">☑︎</span>':'<span role="img" aria-label="Not completed">☐︎</span>'}});function Gp(e){return typeof e!="string"?"":jp.sanitize(R0.parse(e),{FORBID_TAGS:A0,FORBID_ATTR:I0})}var $0=Object.defineProperty,D0=Object.getOwnPropertyDescriptor,ds=(e,t,i,s)=>{for(var r=s>1?void 0:s?D0(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&$0(t,i,r),r};let Ti=class extends ye{constructor(){super(...arguments),this.taskId="",this.hideTitle=!1,this.readOnly=!1,this.isEditing=!1,this.draft="",this.onDocumentPointerDown=e=>{this.isEditing&&(e.composedPath().includes(this)||this.cancelEdit())}}willUpdate(e){e.has("taskId")&&this.resetEditState()}disconnectedCallback(){super.disconnectedCallback(),this.removeDismissListener()}async startEdit(){var e;this.readOnly||(this.draft=this.description??"",this.isEditing=!0,this.addDismissListener(),await this.updateComplete,(e=this.renderRoot.querySelector("sl-textarea"))==null||e.focus())}onDraftInput(e){this.draft=e.currentTarget.value}onKeyDown(e){e.key==="Escape"?(e.preventDefault(),e.stopPropagation(),this.cancelEdit()):(e.metaKey||e.ctrlKey)&&e.key==="Enter"&&(e.preventDefault(),this.saveEdit())}saveEdit(){const e=this.draft.trim();this.isEditing=!1,this.removeDismissListener(),e!==(this.description??"").trim()&&this.dispatchTaskUpdate({description:e})}cancelEdit(){this.draft=this.description??"",this.isEditing=!1,this.removeDismissListener()}resetEditState(){this.isEditing=!1,this.draft="",this.removeDismissListener()}addDismissListener(){document.addEventListener("pointerdown",this.onDocumentPointerDown,{capture:!0})}removeDismissListener(){document.removeEventListener("pointerdown",this.onDocumentPointerDown,{capture:!0})}dispatchTaskUpdate(e){this.dispatchEvent(new CustomEvent("task-update",{detail:{taskId:this.taskId,fields:e},bubbles:!0,composed:!0}))}render(){return this.isEditing?T`
        <div class="section-header">
          ${this.hideTitle?Z:T`<span class="section-title">Description</span>`}
          <span class="actions">
            <sl-icon-button
              name="check2"
              label="Save description"
              @click=${this.saveEdit}
            ></sl-icon-button>
            <sl-icon-button
              name="x-lg"
              label="Cancel description edit"
              @click=${this.cancelEdit}
            ></sl-icon-button>
          </span>
        </div>
        <sl-textarea
          rows="7"
          resize="auto"
          value=${this.draft}
          @input=${this.onDraftInput}
          @keydown=${this.onKeyDown}
        ></sl-textarea>
      `:this.description?T`
      <div class="section-header">
        ${this.hideTitle?Z:T`<span class="section-title">Description</span>`}
        ${this.readOnly?Z:T`<sl-icon-button
          name="pencil"
          label="Edit description"
          @click=${this.startEdit}
        ></sl-icon-button>`}
      </div>
      <div class="content" @dblclick=${this.readOnly?void 0:this.startEdit}>
        <!-- renderMarkdown sanitizes with DOMPurify before this HTML is injected. -->
        ${tc(Gp(this.description))}
      </div>
    `:T`
        <div class="section-header">
          ${this.hideTitle?Z:T`<span class="section-title">Description</span>`}
          ${this.readOnly?Z:T`<sl-icon-button
            name="pencil"
            label="Edit description"
            @click=${this.startEdit}
          ></sl-icon-button>`}
        </div>
        <span class="empty" @click=${this.readOnly?void 0:this.startEdit}>No description</span>
      `}};Ti.styles=[oo,ee`
    :host {
      display: block;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .section-title {
      color: var(--sl-color-neutral-500);
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      margin-left: auto;
    }
    .section-header > sl-icon-button {
      margin-left: auto;
    }
    .content {
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--sl-color-neutral-700);
      cursor: text;
    }
    .content p {
      margin: 0 0 0.5rem;
    }
    .content p:last-child {
      margin-bottom: 0;
    }
    .content code {
      background: var(--sl-color-neutral-100);
      padding: 0.1em 0.3em;
      border-radius: 3px;
      font-size: 0.85em;
    }
    .content pre {
      background: var(--sl-color-neutral-100);
      padding: 0.75rem;
      border-radius: 4px;
      overflow-x: auto;
    }
    .content a {
      color: var(--sl-color-primary-600);
    }
    .empty {
      color: var(--sl-color-neutral-400);
      font-style: italic;
      font-size: 0.875rem;
      cursor: text;
    }
    sl-textarea {
      --sl-input-font-size-medium: 0.875rem;
    }
  `];ds([k()],Ti.prototype,"description",2);ds([k()],Ti.prototype,"taskId",2);ds([k({type:Boolean,attribute:"hide-title"})],Ti.prototype,"hideTitle",2);ds([k({type:Boolean})],Ti.prototype,"readOnly",2);ds([k({attribute:!1})],Ti.prototype,"capabilities",2);ds([U()],Ti.prototype,"isEditing",2);ds([U()],Ti.prototype,"draft",2);Ti=ds([Oe("ft-inspector-desc")],Ti);var N0=Object.defineProperty,L0=Object.getOwnPropertyDescriptor,co=(e,t,i,s)=>{for(var r=s>1?void 0:s?L0(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&N0(t,i,r),r};const P0=new Set([fe.BLOCKS,fe.BLOCKED_BY]);let Qs=class extends ye{constructor(){super(...arguments),this.readOnly=!1}onClickTask(e){this.dispatchEvent(new CustomEvent("task-select",{detail:{taskId:e},bubbles:!0,composed:!0}))}onEntryKeyDown(e,t){(t.key==="Enter"||t.key===" ")&&(t.preventDefault(),this.onClickTask(e))}onRemoveRelationship(e,t){t.stopPropagation(),!this.readOnly&&this.dispatchEvent(new CustomEvent("task-update",{detail:{taskId:this.task.id,fields:{removeRelationships:[e]}},bubbles:!0,composed:!0}))}onAddRelationship(e){this.readOnly||this.dispatchEvent(new CustomEvent("open-add-relationship",{detail:{taskId:this.task.id,relationshipType:e},bubbles:!0,composed:!0}))}renderStageBadge(e){const t=ac[e.stage]??"",i=lc[e.stage]??"var(--sl-color-neutral-500)";return t?T`<span class="stage-badge" style="background:${i}">${t}</span>`:Z}renderEntry(e,t){return T`
      <div class="entry"
        tabindex="0"
        role="button"
        @click=${()=>this.onClickTask(e.id)}
        @keydown=${i=>this.onEntryKeyDown(e.id,i)}
      >
        <span class="entry-name">${e.name}</span>
        ${this.renderStageBadge(e)}
        ${t?T`<sl-icon-button
              class="delete-btn"
              name="trash"
              label="Remove relationship"
              @click=${i=>this.onRemoveRelationship(e.id,i)}
            ></sl-icon-button>`:Z}
      </div>
    `}renderNone(){return T`<div class="none">None</div>`}renderSection(e,t,i){return T`
      <div class="section">
        <div class="section-header">
          <div class="section-label">${e}</div>
        </div>
        ${t.length>0?t.map(s=>this.renderEntry(s,i)):this.renderNone()}
      </div>
    `}render(){const e=this.task;if(!e)return Z;const t=e.parentTaskId?this.store.getTask(e.parentTaskId):void 0,i=t?[t]:[],s=this.store.getChildren(e.id),r=new Map;for(const o of e.relationships){const a=this.store.getTask(o.targetTaskId);if(!a)continue;const c=r.get(o.type);c?c.push(a):r.set(o.type,[a])}const n=!this.readOnly;return T`
      ${this.renderSection("Parent",i,!1)}
      ${this.renderSection("Children",s,!1)}
      ${iy.map(o=>{const a=r.get(o)??[],c=n&&P0.has(o);return T`
          <div class="section">
            <div class="section-header">
              <div class="section-label">${ty[o]}</div>
              ${c?T`<sl-icon-button
                    class="add-btn"
                    name="plus-lg"
                    label="Add relationship"
                    @click=${()=>this.onAddRelationship(o)}
                  ></sl-icon-button>`:Z}
            </div>
            ${a.length>0?a.map(d=>this.renderEntry(d,n)):this.renderNone()}
          </div>
        `})}
    `}};Qs.styles=ee`
    :host {
      display: block;
      padding: 0.5rem 0;
    }
    .section {
      margin-bottom: 1rem;
    }
    .section:last-child {
      margin-bottom: 0;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.25rem;
    }
    .section-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--sl-color-neutral-500);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .add-btn {
      font-size: 0.875rem;
      color: var(--sl-color-neutral-400);
    }
    .add-btn:hover {
      color: var(--sl-color-primary-600);
    }
    .entry {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.3rem 0.375rem;
      margin: 0.125rem 0;
      border-radius: 4px;
      font-size: 0.8125rem;
      color: var(--sl-color-primary-600);
      cursor: pointer;
    }
    .entry:hover {
      background: var(--sl-color-neutral-100);
    }
    .entry:focus-visible {
      outline: 2px solid var(--sl-color-primary-500);
      outline-offset: 2px;
    }
    .entry-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .stage-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.1rem 0.4rem;
      border-radius: 9999px;
      font-size: 0.675rem;
      font-weight: 500;
      color: #fff;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .delete-btn {
      font-size: 0.75rem;
      color: var(--sl-color-neutral-400);
      opacity: 0;
      transition: opacity 0.15s;
      flex-shrink: 0;
    }
    .entry:hover .delete-btn,
    .entry:focus-within .delete-btn {
      opacity: 1;
    }
    .delete-btn:hover {
      color: var(--sl-color-danger-600);
    }
    .none {
      font-style: italic;
      color: var(--sl-color-neutral-400);
      font-size: 0.8125rem;
      padding: 0.25rem 0.375rem;
    }
  `;co([k({attribute:!1})],Qs.prototype,"task",2);co([k({attribute:!1})],Qs.prototype,"store",2);co([k({type:Boolean})],Qs.prototype,"readOnly",2);Qs=co([Oe("ft-inspector-relationships")],Qs);var M0=Object.defineProperty,F0=Object.getOwnPropertyDescriptor,Wp=(e,t,i,s)=>{for(var r=s>1?void 0:s?F0(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&M0(t,i,r),r};const z0={[ws.OPEN]:"primary",[ws.MERGED]:"success",[ws.CLOSED]:"neutral"},B0={[ws.OPEN]:"Open",[ws.MERGED]:"Merged",[ws.CLOSED]:"Closed"},U0={[_i.PENDING]:"neutral",[_i.RUNNING]:"primary",[_i.PASSED]:"success",[_i.FAILED]:"danger"},q0={[_i.PENDING]:"Pending",[_i.RUNNING]:"Running",[_i.PASSED]:"Passed",[_i.FAILED]:"Failed"};let Bn=class extends ye{render(){const e=this.codeContext;return e?T`
      ${e.repo?T`<div class="row">
            <span class="label">Repo</span>
            <span class="value">${e.repo}</span>
          </div>`:Z}

      ${e.branch?T`<div class="row">
            <span class="label">Branch</span>
            <span class="value">${e.branch}</span>
          </div>`:Z}

      ${e.pullRequests.length>0?T`<div class="row">
            <span class="label">PRs</span>
            <span class="pr-list">
              ${e.pullRequests.map(t=>T`
                  <span class="pr-item">
                    <a class="pr-link" href=${t.url} target="_blank" rel="noopener">${t.id}</a>
                    <sl-badge variant=${z0[t.status]??"neutral"} pill>
                      ${B0[t.status]??"Unknown"}
                    </sl-badge>
                  </span>
                `)}
            </span>
          </div>`:Z}

      ${e.ciStatus!=null&&e.ciStatus!==_i.UNSPECIFIED?T`<div class="row">
            <span class="label">CI</span>
            <span class="value">
              <sl-badge variant=${U0[e.ciStatus]??"neutral"} pill>
                ${q0[e.ciStatus]??"Unknown"}
              </sl-badge>
            </span>
          </div>`:Z}
    `:Z}};Bn.styles=ee`
    :host {
      display: block;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 0.375rem 0;
      font-size: 0.8125rem;
      gap: 0.5rem;
    }
    .label {
      color: var(--sl-color-neutral-500);
      flex-shrink: 0;
    }
    .value {
      text-align: right;
      word-break: break-all;
      font-family: var(--sl-font-mono);
      font-size: 0.75rem;
    }
    .pr-list {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      align-items: flex-end;
    }
    .pr-item {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }
    .pr-link {
      color: var(--sl-color-primary-600);
      text-decoration: none;
      font-size: 0.8125rem;
    }
    .pr-link:hover {
      text-decoration: underline;
    }
  `;Wp([k({attribute:!1})],Bn.prototype,"codeContext",2);Bn=Wp([Oe("ft-inspector-code")],Bn);var H0=Object.defineProperty,V0=Object.getOwnPropertyDescriptor,ui=(e,t,i,s)=>{for(var r=s>1?void 0:s?V0(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&H0(t,i,r),r};let Ht=class extends ye{constructor(){super(...arguments),this.taskId="",this.readOnly=!1,this.comments=[],this.loading=!1,this.loaded=!1,this.draft="",this.submitting=!1,this.errorMessage="",this.cachedTaskId=""}updated(e){var t;if(e.has("taskId")&&this.taskId!==this.cachedTaskId){this.loaded=!1,this.comments=[],this.draft="",this.errorMessage="",this.cachedTaskId=this.taskId;const i=(t=this.shadowRoot)==null?void 0:t.querySelector("sl-details");i!=null&&i.open&&this.onExpand()}}isSectionOpen(){return localStorage.getItem("inspector.collapse.comments")!=="false"}async onExpand(){if(localStorage.setItem("inspector.collapse.comments","true"),!(this.loaded&&this.cachedTaskId===this.taskId)&&!(!this.client||!this.taskId)){this.loading=!0,this.errorMessage="";try{this.comments=await this.client.listComments(this.taskId),this.cachedTaskId=this.taskId,this.loaded=!0}catch(e){this.errorMessage=e instanceof Error?e.message:"Failed to load comments"}finally{this.loading=!1}}}onCollapse(){localStorage.setItem("inspector.collapse.comments","false")}onDraftInput(e){this.draft=e.currentTarget.value,this.errorMessage&&(this.errorMessage="")}onKeyDown(e){e.key==="Enter"&&(e.metaKey||e.ctrlKey)&&(e.preventDefault(),this.submitComment())}async submitComment(){var t;if(this.readOnly)return;const e=this.trimmedDraft;if(!e){this.errorMessage="Enter a comment before submitting.";return}if(!(!this.client||!this.taskId||this.submitting)){this.submitting=!0,this.errorMessage="";try{const i=await this.client.addComment(this.taskId,e);this.comments=[i,...this.comments],this.loaded=!0,this.draft="",await this.updateComplete,(t=this.renderRoot.querySelector("sl-textarea"))==null||t.focus()}catch(i){this.errorMessage=i instanceof Error?i.message:"Failed to add comment"}finally{this.submitting=!1}}}authorName(e){return e.author.name.trim()||e.author.id||"Unknown author"}get trimmedDraft(){return this.draft.trim()}render(){const e=this.loaded?this.comments.length:"",t=`Comments${e!==""?` (${e})`:""}`;return T`
      <sl-details summary=${t} ?open=${this.isSectionOpen()} @sl-show=${this.onExpand} @sl-hide=${this.onCollapse}>
        ${this.errorMessage?T`
              <sl-alert variant="danger" open closable @sl-after-hide=${()=>{this.errorMessage=""}}>
                ${this.errorMessage}
              </sl-alert>
            `:Z}
        ${this.loading?T`<sl-spinner style="font-size: 1rem;"></sl-spinner>`:this.loaded&&this.comments.length===0?T`<div class="empty">No comments</div>`:this.comments.map(i=>{const s=this.authorName(i);return T`
                    <div class="comment">
                      <div class="comment-header">
                        <sl-avatar
                          initials=${s.slice(0,2)}
                          label=${s}
                          style="--size: 1.4rem; font-size: 0.55rem;"
                        ></sl-avatar>
                        <span class="comment-author">${s}</span>
                        <span class="comment-time">${Ap(i.createdAt)}</span>
                      </div>
                      <div class="comment-body">
                        ${tc(Gp(i.body))}
                      </div>
                    </div>
                  `})}
        ${this.readOnly?Z:T`<div class="comment-form">
          <sl-textarea
            label="Add comment"
            placeholder="Ctrl+Enter to submit"
            rows="3"
            resize="auto"
            value=${this.draft}
            ?disabled=${this.submitting}
            @input=${this.onDraftInput}
            @keydown=${this.onKeyDown}
          ></sl-textarea>
          <div class="comment-actions">
            <sl-button
              size="small"
              variant="primary"
              ?loading=${this.submitting}
              ?disabled=${!this.trimmedDraft||this.submitting}
              @click=${this.submitComment}
            >
              Add comment
            </sl-button>
          </div>
        </div>`}
      </sl-details>
    `}};Ht.styles=ee`
    :host {
      display: block;
    }
    .comment {
      padding: 0.5rem 0;
    }
    .comment + .comment {
      border-top: 1px solid var(--sl-color-neutral-200);
    }
    .comment-header {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      margin-bottom: 0.25rem;
    }
    .comment-author {
      font-size: 0.8125rem;
      font-weight: 500;
    }
    .comment-time {
      font-size: 0.7rem;
      color: var(--sl-color-neutral-500);
      margin-left: auto;
    }
    .comment-body {
      font-size: 0.8125rem;
      line-height: 1.5;
      color: var(--sl-color-neutral-700);
    }
    .comment-body p {
      margin: 0 0 0.25rem;
    }
    .comment-body p:last-child {
      margin-bottom: 0;
    }
    .empty {
      font-size: 0.8125rem;
      color: var(--sl-color-neutral-400);
      font-style: italic;
      padding: 0.5rem 0;
    }
    .comment-form {
      display: grid;
      gap: 0.5rem;
      padding-top: 0.75rem;
    }
    sl-textarea {
      --sl-input-font-size-medium: 0.8125rem;
    }
    .comment-actions {
      display: flex;
      justify-content: flex-end;
    }
    sl-alert {
      font-size: 0.8125rem;
    }
  `;ui([k()],Ht.prototype,"taskId",2);ui([k({type:Boolean})],Ht.prototype,"readOnly",2);ui([k({attribute:!1})],Ht.prototype,"capabilities",2);ui([k({attribute:!1})],Ht.prototype,"client",2);ui([U()],Ht.prototype,"comments",2);ui([U()],Ht.prototype,"loading",2);ui([U()],Ht.prototype,"loaded",2);ui([U()],Ht.prototype,"draft",2);ui([U()],Ht.prototype,"submitting",2);ui([U()],Ht.prototype,"errorMessage",2);Ht=ui([Oe("ft-inspector-comments")],Ht);var j0=Object.defineProperty,G0=Object.getOwnPropertyDescriptor,or=(e,t,i,s)=>{for(var r=s>1?void 0:s?G0(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&j0(t,i,r),r};function Bu(e){return e==null?"—":typeof e=="string"?e:String(e)}let rs=class extends ye{constructor(){super(...arguments),this.taskId="",this.changes=[],this.loading=!1,this.loaded=!1,this.cachedTaskId=""}updated(e){var t;if(e.has("taskId")&&this.taskId!==this.cachedTaskId){this.loaded=!1,this.changes=[],this.cachedTaskId=this.taskId;const i=(t=this.shadowRoot)==null?void 0:t.querySelector("sl-details");i!=null&&i.open&&this.onExpand()}}isSectionOpen(){return localStorage.getItem("inspector.collapse.changes")!=="false"}async onExpand(){if(localStorage.setItem("inspector.collapse.changes","true"),!(this.loaded&&this.cachedTaskId===this.taskId)&&!(!this.client||!this.taskId)){this.loading=!0;try{this.changes=await this.client.listChanges(this.taskId),this.cachedTaskId=this.taskId,this.loaded=!0}finally{this.loading=!1}}}onCollapse(){localStorage.setItem("inspector.collapse.changes","false")}render(){const e=this.loaded?this.changes.length:"",t=`Change History${e!==""?` (${e})`:""}`;return T`
      <sl-details summary=${t} ?open=${this.isSectionOpen()} @sl-show=${this.onExpand} @sl-hide=${this.onCollapse}>
        ${this.loading?T`<sl-spinner style="font-size: 1rem;"></sl-spinner>`:this.loaded&&this.changes.length===0?T`<div class="empty">No changes recorded</div>`:this.changes.map(i=>T`
                  <div class="entry">
                    <div class="entry-header">
                      <span class="field-name">${i.field}</span>
                      <span class="entry-time">${Ap(i.changedAt)}</span>
                    </div>
                    <div class="entry-values">
                      ${i.oldValue!=null?T`<span class="old-value">${Bu(i.oldValue)}</span><span class="arrow">→</span>`:Z}
                      <span>${Bu(i.newValue)}</span>
                    </div>
                    <div class="changed-by">${i.changedBy.name}</div>
                  </div>
                `)}
      </sl-details>
    `}};rs.styles=ee`
    :host {
      display: block;
    }
    .entry {
      padding: 0.5rem 0;
      font-size: 0.8125rem;
    }
    .entry + .entry {
      border-top: 1px solid var(--sl-color-neutral-200);
    }
    .entry-header {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      margin-bottom: 0.25rem;
    }
    .field-name {
      font-weight: 500;
    }
    .entry-time {
      font-size: 0.7rem;
      color: var(--sl-color-neutral-500);
      margin-left: auto;
    }
    .entry-values {
      font-size: 0.75rem;
      color: var(--sl-color-neutral-600);
    }
    .old-value {
      text-decoration: line-through;
      color: var(--sl-color-neutral-400);
    }
    .arrow {
      color: var(--sl-color-neutral-400);
      margin: 0 0.25rem;
    }
    .changed-by {
      font-size: 0.7rem;
      color: var(--sl-color-neutral-500);
    }
    .empty {
      font-size: 0.8125rem;
      color: var(--sl-color-neutral-400);
      font-style: italic;
      padding: 0.5rem 0;
    }
  `;or([k()],rs.prototype,"taskId",2);or([k({attribute:!1})],rs.prototype,"client",2);or([U()],rs.prototype,"changes",2);or([U()],rs.prototype,"loading",2);or([U()],rs.prototype,"loaded",2);rs=or([Oe("ft-inspector-changes")],rs);var W0=Object.defineProperty,Y0=Object.getOwnPropertyDescriptor,ar=(e,t,i,s)=>{for(var r=s>1?void 0:s?Y0(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&W0(t,i,r),r};let ns=class extends ye{constructor(){super(...arguments),this.taskId="",this.readOnly=!1}connectedCallback(){super.connectedCallback(),this.storeCtrl||(this.storeCtrl=new Is(this,this.store)),this.addEventListener("keydown",this.onBodyKeyDown)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("keydown",this.onBodyKeyDown)}isSectionOpen(e){return localStorage.getItem(`inspector.collapse.${e}`)!=="false"}persistSectionState(e,t){localStorage.setItem(`inspector.collapse.${e}`,String(t))}onClose(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}onBodyKeyDown(e){e.key==="Escape"&&(e.preventDefault(),e.stopPropagation(),this.onClose())}render(){const e=this.store.getTask(this.taskId);return e?T`
      <div class="header-bar">
        <span class="header-label">Inspector</span>
        <sl-icon-button
          class="close-btn"
          name="x-lg"
          label="Close inspector"
          @click=${this.onClose}
        ></sl-icon-button>
      </div>

      <ft-inspector-header .task=${e} ?readOnly=${this.readOnly} .capabilities=${this.capabilities}></ft-inspector-header>

      <sl-tab-group>
        <sl-tab slot="nav" panel="general" active>General</sl-tab>
        <sl-tab slot="nav" panel="relationships">Relationships</sl-tab>

        <sl-tab-panel name="general" active>
          <div class="body" tabindex="0">
            <sl-details
              summary="Properties"
              ?open=${this.isSectionOpen("metadata")}
              @sl-show=${()=>this.persistSectionState("metadata",!0)}
              @sl-hide=${()=>this.persistSectionState("metadata",!1)}
            >
              <ft-inspector-meta .task=${e} .client=${this.client} ?readOnly=${this.readOnly} .capabilities=${this.capabilities}></ft-inspector-meta>
            </sl-details>

            <sl-details
              summary="Description"
              ?open=${this.isSectionOpen("description")}
              @sl-show=${()=>this.persistSectionState("description",!0)}
              @sl-hide=${()=>this.persistSectionState("description",!1)}
            >
              <ft-inspector-desc
                taskId=${e.id}
                .description=${e.description}
                ?readOnly=${this.readOnly}
                .capabilities=${this.capabilities}
                hide-title
              ></ft-inspector-desc>
            </sl-details>

            ${e.codeContext?T`
                  <sl-details
                    summary="Code"
                    ?open=${this.isSectionOpen("code")}
                    @sl-show=${()=>this.persistSectionState("code",!0)}
                    @sl-hide=${()=>this.persistSectionState("code",!1)}
                  >
                    <ft-inspector-code .codeContext=${e.codeContext}></ft-inspector-code>
                  </sl-details>
                `:Z}

            <ft-inspector-comments
              taskId=${this.taskId}
              .client=${this.client}
              ?readOnly=${this.readOnly}
              .capabilities=${this.capabilities}
            ></ft-inspector-comments>

            <ft-inspector-changes
              taskId=${this.taskId}
              .client=${this.client}
            ></ft-inspector-changes>
          </div>
        </sl-tab-panel>

        <sl-tab-panel name="relationships">
          <ft-inspector-relationships
            .task=${e}
            .store=${this.store}
            ?readOnly=${this.readOnly}
          ></ft-inspector-relationships>
        </sl-tab-panel>
      </sl-tab-group>
    `:T`
        <div class="header-bar">
          <span class="header-label">Inspector</span>
          <sl-icon-button
            class="close-btn"
            name="x-lg"
            label="Close inspector"
            @click=${this.onClose}
          ></sl-icon-button>
        </div>
        <div style="color: var(--sl-color-neutral-400); font-style: italic; padding: 1rem 0;">
          Task not found
        </div>
      `}};ns.styles=[oo,ee`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 0.5rem;
      flex-shrink: 0;
    }
    .header-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--sl-color-neutral-500);
      font-weight: 600;
    }
    .close-btn {
      color: var(--sl-color-neutral-500);
    }
    .close-btn:hover {
      color: var(--sl-color-neutral-900);
    }
    .body {
      padding-bottom: 1rem;
    }
    sl-tab-group {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    sl-tab-group::part(base) {
      height: 100%;
    }
    sl-tab-group::part(body) {
      flex: 1;
      overflow: hidden;
      min-height: 0;
    }
    sl-tab-panel {
      height: 100%;
      overflow-y: auto;
    }
    sl-tab-panel::part(base) {
      padding: 0.5rem 0 0;
      height: 100%;
      overflow-y: auto;
    }
    ft-inspector-header {
      margin-bottom: 0.5rem;
      flex-shrink: 0;
    }
    sl-details,
    ft-inspector-comments,
    ft-inspector-changes {
      margin-top: 0.75rem;
    }
    sl-details::part(base) {
      border: 1px solid var(--sl-color-neutral-200);
      border-radius: var(--sl-border-radius-medium);
    }
    sl-details::part(header) {
      padding: 0.5rem 0.75rem;
    }
    sl-details::part(content) {
      padding: 0 0.75rem 0.75rem;
    }
  `];ar([k()],ns.prototype,"taskId",2);ar([k({attribute:!1})],ns.prototype,"store",2);ar([k({attribute:!1})],ns.prototype,"client",2);ar([k({type:Boolean})],ns.prototype,"readOnly",2);ar([k({attribute:!1})],ns.prototype,"capabilities",2);ns=ar([Oe("ft-inspector")],ns);var K0=Object.defineProperty,X0=Object.getOwnPropertyDescriptor,uo=(e,t,i,s)=>{for(var r=s>1?void 0:s?X0(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&K0(t,i,r),r};let er=class extends ye{constructor(){super(...arguments),this.token="",this.loading=!1,this.error=""}render(){return T`
      <div class="overlay">
        <div class="dialog">
          <h2>Sign in to Farm Table</h2>
          <p>
            Enter your API token to access the dashboard. Tokens start with
            <code>ft_</code> and can be generated using the CLI.
          </p>
          <div class="form">
            <sl-input
              type="password"
              placeholder="ft_..."
              size="medium"
              .value=${this.token}
              ?disabled=${this.loading}
              @sl-input=${this.onTokenInput}
              @keydown=${this.onKeyDown}
            >
              <sl-icon name="key" slot="prefix"></sl-icon>
            </sl-input>
            <p class="error">${this.error}</p>
            <div class="actions">
              <sl-button
                variant="primary"
                size="medium"
                ?loading=${this.loading}
                ?disabled=${!this.token.trim()||this.loading}
                @click=${this.onLogin}
              >
                Sign in
              </sl-button>
            </div>
          </div>
        </div>
      </div>
    `}onTokenInput(e){const t=e.target;this.token=t.value,this.error=""}onKeyDown(e){e.key==="Enter"&&this.token.trim()&&this.onLogin()}async onLogin(){if(!(this.loading||!this.token.trim())){this.loading=!0,this.error="";try{const e=await fetch("/api/auth/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:this.token.trim()})});if(!e.ok){const t=await e.json().catch(()=>({}));this.error=t.error||"Authentication failed",this.loading=!1;return}window.location.reload()}catch{this.error="Could not reach the server. Please try again.",this.loading=!1}}}};er.styles=ee`
    :host {
      display: block;
    }
    .overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fade-in 0.2s ease-out;
    }
    @keyframes fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .dialog {
      background: var(--sl-color-neutral-0, #fff);
      border-radius: var(--sl-border-radius-large, 8px);
      box-shadow: var(--sl-shadow-x-large, 0 8px 32px rgba(0,0,0,0.2));
      padding: 2rem;
      max-width: 420px;
      width: 90vw;
    }
    h2 {
      margin: 0 0 0.5rem;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--sl-color-neutral-900, #1a1a1a);
    }
    p {
      margin: 0 0 1.5rem;
      font-size: 0.875rem;
      color: var(--sl-color-neutral-600, #666);
      line-height: 1.5;
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .error {
      color: var(--sl-color-danger-600, #dc2626);
      font-size: 0.8rem;
      margin: 0;
      min-height: 1.2em;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `;uo([U()],er.prototype,"token",2);uo([U()],er.prototype,"loading",2);uo([U()],er.prototype,"error",2);er=uo([Oe("ft-login-dialog")],er);function Un(e){if(e==null)return String(e);if(typeof e!="object")return JSON.stringify(e);if(Array.isArray(e))return"["+e.map(Un).join(",")+"]";const t=e;return"{"+Object.keys(t).sort().map(s=>JSON.stringify(s)+":"+Un(t[s])).join(",")+"}"}class J0 extends EventTarget{constructor(){super(...arguments),this.tasks=new Map,this._childMap=new Map,this._allTasksCache=null,this._rootsCache=null,this._isLoading=!0}get isLoading(){return this._isLoading}get taskCount(){return this.tasks.size}get allTasks(){return this._allTasksCache||(this._allTasksCache=[...this.tasks.values()]),[...this._allTasksCache]}getTask(t){return this.tasks.get(t)}getByStage(t){return this.allTasks.filter(i=>i.stage===t)}get byStage(){const t=new Map;for(const i of this.tasks.values()){const s=t.get(i.stage);s?s.push(i):t.set(i.stage,[i])}return t}get byParent(){return this._childMap}get roots(){return this._rootsCache||(this._rootsCache=[...this.allTasks.filter(t=>!t.parentTaskId)]),[...this._rootsCache]}getChildren(t){return[...this._childMap.get(t)??[]]}_addToChildMap(t){if(t.parentTaskId){const i=this._childMap.get(t.parentTaskId);i?i.push(t):this._childMap.set(t.parentTaskId,[t])}}_removeFromChildMap(t){if(t.parentTaskId){const i=this._childMap.get(t.parentTaskId);if(i){const s=i.indexOf(t);s>=0&&i.splice(s,1),i.length===0&&this._childMap.delete(t.parentTaskId)}}}_invalidateCaches(){this._allTasksCache=null,this._rootsCache=null}upsert(t,i){const s=this.tasks.get(t.id);return s&&!i&&Un(s)===Un(t)?!1:(s&&this._removeFromChildMap(s),this.tasks.set(t.id,t),this._addToChildMap(t),this._invalidateCaches(),this.dispatchEvent(new CustomEvent("tasks-changed",{detail:{task:t}})),!0)}delete(t){const i=this.tasks.get(t);i&&this._removeFromChildMap(i),this.tasks.delete(t),this._invalidateCaches(),this.dispatchEvent(new CustomEvent("tasks-changed",{detail:{taskId:t}}))}snapshotComplete(){this._isLoading=!1,this.dispatchEvent(new CustomEvent("snapshot-complete"))}clear(){this.tasks.clear(),this._childMap.clear(),this._invalidateCaches(),this._isLoading=!0,this.dispatchEvent(new CustomEvent("tasks-changed"))}}var Tn={exports:{}},Z0=Tn.exports,Uu;function Q0(){return Uu||(Uu=1,(function(e,t){(function(i,s){e.exports=s()})(Z0,(function(){return i={418:function(r,n){(function(o,a){for(var c in a)o[c]=a[c]})(n,(function(o){var a={};function c(d){if(a[d])return a[d].exports;var l=a[d]={i:d,l:!1,exports:{}};return o[d].call(l.exports,l,l.exports,c),l.l=!0,l.exports}return c.m=o,c.c=a,c.i=function(d){return d},c.d=function(d,l,u){c.o(d,l)||Object.defineProperty(d,l,{configurable:!1,enumerable:!0,get:u})},c.n=function(d){var l=d&&d.__esModule?function(){return d.default}:function(){return d};return c.d(l,"a",l),l},c.o=function(d,l){return Object.prototype.hasOwnProperty.call(d,l)},c.p="",c(c.s=1)})([function(o,a,c){Object.defineProperty(a,"__esModule",{value:!0});var d=c(3),l=(function(){function u(p,h){p===void 0&&(p={}),h===void 0&&(h={splitValues:!1});var g,f=this;this.headersMap={},p&&(typeof Headers<"u"&&p instanceof Headers?d.getHeaderKeys(p).forEach((function(m){d.getHeaderValues(p,m).forEach((function(b){h.splitValues?f.append(m,d.splitHeaderValue(b)):f.append(m,b)}))})):typeof(g=p)=="object"&&typeof g.headersMap=="object"&&typeof g.forEach=="function"?p.forEach((function(m,b){f.append(m,b)})):typeof Map<"u"&&p instanceof Map?p.forEach((function(m,b){f.append(b,m)})):typeof p=="string"?this.appendFromString(p):typeof p=="object"&&Object.getOwnPropertyNames(p).forEach((function(m){var b=p[m];Array.isArray(b)?b.forEach((function(v){f.append(m,v)})):f.append(m,b)})))}return u.prototype.appendFromString=function(p){for(var h=p.split(`\r
`),g=0;g<h.length;g++){var f=h[g],m=f.indexOf(":");if(m>0){var b=f.substring(0,m).trim(),v=f.substring(m+1).trim();this.append(b,v)}}},u.prototype.delete=function(p,h){var g=d.normalizeName(p);if(h===void 0)delete this.headersMap[g];else{var f=this.headersMap[g];if(f){var m=f.indexOf(h);m>=0&&f.splice(m,1),f.length===0&&delete this.headersMap[g]}}},u.prototype.append=function(p,h){var g=this,f=d.normalizeName(p);Array.isArray(this.headersMap[f])||(this.headersMap[f]=[]),Array.isArray(h)?h.forEach((function(m){g.headersMap[f].push(d.normalizeValue(m))})):this.headersMap[f].push(d.normalizeValue(h))},u.prototype.set=function(p,h){var g=d.normalizeName(p);if(Array.isArray(h)){var f=[];h.forEach((function(m){f.push(d.normalizeValue(m))})),this.headersMap[g]=f}else this.headersMap[g]=[d.normalizeValue(h)]},u.prototype.has=function(p,h){var g=this.headersMap[d.normalizeName(p)];if(!Array.isArray(g))return!1;if(h!==void 0){var f=d.normalizeValue(h);return g.indexOf(f)>=0}return!0},u.prototype.get=function(p){var h=this.headersMap[d.normalizeName(p)];return h!==void 0?h.concat():[]},u.prototype.forEach=function(p){var h=this;Object.getOwnPropertyNames(this.headersMap).forEach((function(g){p(g,h.headersMap[g])}),this)},u.prototype.toHeaders=function(){if(typeof Headers<"u"){var p=new Headers;return this.forEach((function(h,g){g.forEach((function(f){p.append(h,f)}))})),p}throw new Error("Headers class is not defined")},u})();a.BrowserHeaders=l},function(o,a,c){Object.defineProperty(a,"__esModule",{value:!0});var d=c(0);a.BrowserHeaders=d.BrowserHeaders},function(o,a,c){Object.defineProperty(a,"__esModule",{value:!0}),a.iterateHeaders=function(d,l){for(var u=d[Symbol.iterator](),p=u.next();!p.done;)l(p.value[0]),p=u.next()},a.iterateHeadersKeys=function(d,l){for(var u=d.keys(),p=u.next();!p.done;)l(p.value),p=u.next()}},function(o,a,c){Object.defineProperty(a,"__esModule",{value:!0});var d=c(2);a.normalizeName=function(l){if(typeof l!="string"&&(l=String(l)),/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(l))throw new TypeError("Invalid character in header field name");return l.toLowerCase()},a.normalizeValue=function(l){return typeof l!="string"&&(l=String(l)),l},a.getHeaderValues=function(l,u){var p=l;if(p instanceof Headers&&p.getAll)return p.getAll(u);var h=p.get(u);return h&&typeof h=="string"?[h]:h},a.getHeaderKeys=function(l){var u=l,p={},h=[];return u.keys?d.iterateHeadersKeys(u,(function(g){p[g]||(p[g]=!0,h.push(g))})):u.forEach?u.forEach((function(g,f){p[f]||(p[f]=!0,h.push(f))})):d.iterateHeaders(u,(function(g){var f=g[0];p[f]||(p[f]=!0,h.push(f))})),h},a.splitHeaderValue=function(l){var u=[];return l.split(", ").forEach((function(p){p.split(",").forEach((function(h){u.push(h)}))})),u}}]))},617:function(r,n,o){Object.defineProperty(n,"__esModule",{value:!0}),n.ChunkParser=n.ChunkType=n.encodeASCII=n.decodeASCII=void 0;var a,c=o(65);function d(m){return(b=m)===9||b===10||b===13||m>=32&&m<=126;var b}function l(m){for(var b=0;b!==m.length;++b)if(!d(m[b]))throw new Error("Metadata is not valid (printable) ASCII");return String.fromCharCode.apply(String,Array.prototype.slice.call(m))}function u(m){return(128&m.getUint8(0))==128}function p(m){return m.getUint32(1,!1)}function h(m,b,v){return m.byteLength-b>=v}function g(m,b,v){if(m.slice)return m.slice(b,v);var y=m.length;v!==void 0&&(y=v);for(var w=new Uint8Array(y-b),C=0,O=b;O<y;O++)w[C++]=m[O];return w}n.decodeASCII=l,n.encodeASCII=function(m){for(var b=new Uint8Array(m.length),v=0;v!==m.length;++v){var y=m.charCodeAt(v);if(!d(y))throw new Error("Metadata contains invalid ASCII");b[v]=y}return b},(function(m){m[m.MESSAGE=1]="MESSAGE",m[m.TRAILERS=2]="TRAILERS"})(a=n.ChunkType||(n.ChunkType={}));var f=(function(){function m(){this.buffer=null,this.position=0}return m.prototype.parse=function(b,v){if(b.length===0&&v)return[];var y,w=[];if(this.buffer==null)this.buffer=b,this.position=0;else if(this.position===this.buffer.byteLength)this.buffer=b,this.position=0;else{var C=this.buffer.byteLength-this.position,O=new Uint8Array(C+b.byteLength),M=g(this.buffer,this.position);O.set(M,0);var A=new Uint8Array(b);O.set(A,C),this.buffer=O,this.position=0}for(;;){if(!h(this.buffer,this.position,5))return w;var R=g(this.buffer,this.position,this.position+5),D=new DataView(R.buffer,R.byteOffset,R.byteLength),F=p(D);if(!h(this.buffer,this.position,5+F))return w;var P=g(this.buffer,this.position+5,this.position+5+F);if(this.position+=5+F,u(D))return w.push({chunkType:a.TRAILERS,trailers:(y=P,new c.Metadata(l(y)))}),w;w.push({chunkType:a.MESSAGE,data:P})}},m})();n.ChunkParser=f},8:function(r,n){var o;Object.defineProperty(n,"__esModule",{value:!0}),n.httpStatusToCode=n.Code=void 0,(function(a){a[a.OK=0]="OK",a[a.Canceled=1]="Canceled",a[a.Unknown=2]="Unknown",a[a.InvalidArgument=3]="InvalidArgument",a[a.DeadlineExceeded=4]="DeadlineExceeded",a[a.NotFound=5]="NotFound",a[a.AlreadyExists=6]="AlreadyExists",a[a.PermissionDenied=7]="PermissionDenied",a[a.ResourceExhausted=8]="ResourceExhausted",a[a.FailedPrecondition=9]="FailedPrecondition",a[a.Aborted=10]="Aborted",a[a.OutOfRange=11]="OutOfRange",a[a.Unimplemented=12]="Unimplemented",a[a.Internal=13]="Internal",a[a.Unavailable=14]="Unavailable",a[a.DataLoss=15]="DataLoss",a[a.Unauthenticated=16]="Unauthenticated"})(o=n.Code||(n.Code={})),n.httpStatusToCode=function(a){switch(a){case 0:return o.Internal;case 200:return o.OK;case 400:return o.InvalidArgument;case 401:return o.Unauthenticated;case 403:return o.PermissionDenied;case 404:return o.NotFound;case 409:return o.Aborted;case 412:return o.FailedPrecondition;case 429:return o.ResourceExhausted;case 499:return o.Canceled;case 500:return o.Unknown;case 501:return o.Unimplemented;case 503:return o.Unavailable;case 504:return o.DeadlineExceeded;default:return o.Unknown}}},934:function(r,n,o){Object.defineProperty(n,"__esModule",{value:!0}),n.client=void 0;var a=o(65),c=o(617),d=o(8),l=o(346),u=o(57),p=o(882);n.client=function(f,m){return new h(f,m)};var h=(function(){function f(m,b){this.started=!1,this.sentFirstMessage=!1,this.completed=!1,this.closed=!1,this.finishedSending=!1,this.onHeadersCallbacks=[],this.onMessageCallbacks=[],this.onEndCallbacks=[],this.parser=new c.ChunkParser,this.methodDefinition=m,this.props=b,this.createTransport()}return f.prototype.createTransport=function(){var m=this.props.host+"/"+this.methodDefinition.service.serviceName+"/"+this.methodDefinition.methodName,b={methodDefinition:this.methodDefinition,debug:this.props.debug||!1,url:m,onHeaders:this.onTransportHeaders.bind(this),onChunk:this.onTransportChunk.bind(this),onEnd:this.onTransportEnd.bind(this)};this.props.transport?this.transport=this.props.transport(b):this.transport=u.makeDefaultTransport(b)},f.prototype.onTransportHeaders=function(m,b){if(this.props.debug&&l.debug("onHeaders",m,b),this.closed)this.props.debug&&l.debug("grpc.onHeaders received after request was closed - ignoring");else if(b!==0){this.responseHeaders=m,this.props.debug&&l.debug("onHeaders.responseHeaders",JSON.stringify(this.responseHeaders,null,2));var v=g(m);this.props.debug&&l.debug("onHeaders.gRPCStatus",v);var y=v&&v>=0?v:d.httpStatusToCode(b);this.props.debug&&l.debug("onHeaders.code",y);var w=m.get("grpc-message")||[];if(this.props.debug&&l.debug("onHeaders.gRPCMessage",w),this.rawOnHeaders(m),y!==d.Code.OK){var C=this.decodeGRPCStatus(w[0]);this.rawOnError(y,C,m)}}},f.prototype.onTransportChunk=function(m){var b=this;if(this.closed)this.props.debug&&l.debug("grpc.onChunk received after request was closed - ignoring");else{var v=[];try{v=this.parser.parse(m)}catch(y){return this.props.debug&&l.debug("onChunk.parsing error",y,y.message),void this.rawOnError(d.Code.Internal,"parsing error: "+y.message)}v.forEach((function(y){if(y.chunkType===c.ChunkType.MESSAGE){var w=b.methodDefinition.responseType.deserializeBinary(y.data);b.rawOnMessage(w)}else y.chunkType===c.ChunkType.TRAILERS&&(b.responseHeaders?(b.responseTrailers=new a.Metadata(y.trailers),b.props.debug&&l.debug("onChunk.trailers",b.responseTrailers)):(b.responseHeaders=new a.Metadata(y.trailers),b.rawOnHeaders(b.responseHeaders)))}))}},f.prototype.onTransportEnd=function(){if(this.props.debug&&l.debug("grpc.onEnd"),this.closed)this.props.debug&&l.debug("grpc.onEnd received after request was closed - ignoring");else if(this.responseTrailers!==void 0){var m=g(this.responseTrailers);if(m!==null){var b=this.responseTrailers.get("grpc-message"),v=this.decodeGRPCStatus(b[0]);this.rawOnEnd(m,v,this.responseTrailers)}else this.rawOnError(d.Code.Internal,"Response closed without grpc-status (Trailers provided)")}else{if(this.responseHeaders===void 0)return void this.rawOnError(d.Code.Unknown,"Response closed without headers");var y=g(this.responseHeaders),w=this.responseHeaders.get("grpc-message");if(this.props.debug&&l.debug("grpc.headers only response ",y,w),y===null)return void this.rawOnEnd(d.Code.Unknown,"Response closed without grpc-status (Headers only)",this.responseHeaders);var C=this.decodeGRPCStatus(w[0]);this.rawOnEnd(y,C,this.responseHeaders)}},f.prototype.decodeGRPCStatus=function(m){if(!m)return"";try{return decodeURIComponent(m)}catch{return m}},f.prototype.rawOnEnd=function(m,b,v){var y=this;this.props.debug&&l.debug("rawOnEnd",m,b,v),this.completed||(this.completed=!0,this.onEndCallbacks.forEach((function(w){if(!y.closed)try{w(m,b,v)}catch(C){setTimeout((function(){throw C}),0)}})))},f.prototype.rawOnHeaders=function(m){this.props.debug&&l.debug("rawOnHeaders",m),this.completed||this.onHeadersCallbacks.forEach((function(b){try{b(m)}catch(v){setTimeout((function(){throw v}),0)}}))},f.prototype.rawOnError=function(m,b,v){var y=this;v===void 0&&(v=new a.Metadata),this.props.debug&&l.debug("rawOnError",m,b),this.completed||(this.completed=!0,this.onEndCallbacks.forEach((function(w){if(!y.closed)try{w(m,b,v)}catch(C){setTimeout((function(){throw C}),0)}})))},f.prototype.rawOnMessage=function(m){var b=this;this.props.debug&&l.debug("rawOnMessage",m.toObject()),this.completed||this.closed||this.onMessageCallbacks.forEach((function(v){if(!b.closed)try{v(m)}catch(y){setTimeout((function(){throw y}),0)}}))},f.prototype.onHeaders=function(m){this.onHeadersCallbacks.push(m)},f.prototype.onMessage=function(m){this.onMessageCallbacks.push(m)},f.prototype.onEnd=function(m){this.onEndCallbacks.push(m)},f.prototype.start=function(m){if(this.started)throw new Error("Client already started - cannot .start()");this.started=!0;var b=new a.Metadata(m||{});b.set("content-type","application/grpc-web+proto"),b.set("x-grpc-web","1"),this.transport.start(b)},f.prototype.send=function(m){if(!this.started)throw new Error("Client not started - .start() must be called before .send()");if(this.closed)throw new Error("Client already closed - cannot .send()");if(this.finishedSending)throw new Error("Client already finished sending - cannot .send()");if(!this.methodDefinition.requestStream&&this.sentFirstMessage)throw new Error("Message already sent for non-client-streaming method - cannot .send()");this.sentFirstMessage=!0;var b=p.frameRequest(m);this.transport.sendMessage(b)},f.prototype.finishSend=function(){if(!this.started)throw new Error("Client not started - .finishSend() must be called before .close()");if(this.closed)throw new Error("Client already closed - cannot .send()");if(this.finishedSending)throw new Error("Client already finished sending - cannot .finishSend()");this.finishedSending=!0,this.transport.finishSend()},f.prototype.close=function(){if(!this.started)throw new Error("Client not started - .start() must be called before .close()");if(this.closed)throw new Error("Client already closed - cannot .close()");this.closed=!0,this.props.debug&&l.debug("request.abort aborting request"),this.transport.cancel()},f})();function g(f){var m=f.get("grpc-status")||[];if(m.length>0)try{var b=m[0];return parseInt(b,10)}catch{return null}return null}},346:function(r,n){Object.defineProperty(n,"__esModule",{value:!0}),n.debug=void 0,n.debug=function(){for(var o=[],a=0;a<arguments.length;a++)o[a]=arguments[a];console.debug?console.debug.apply(null,o):console.log.apply(null,o)}},607:function(r,n,o){Object.defineProperty(n,"__esModule",{value:!0}),n.grpc=void 0;var a,c=o(418),d=o(57),l=o(229),u=o(540),p=o(210),h=o(859),g=o(8),f=o(938),m=o(35),b=o(934);(a=n.grpc||(n.grpc={})).setDefaultTransport=d.setDefaultTransportFactory,a.CrossBrowserHttpTransport=h.CrossBrowserHttpTransport,a.FetchReadableStreamTransport=l.FetchReadableStreamTransport,a.XhrTransport=p.XhrTransport,a.WebsocketTransport=u.WebsocketTransport,a.Code=g.Code,a.Metadata=c.BrowserHeaders,a.client=function(v,y){return b.client(v,y)},a.invoke=f.invoke,a.unary=m.unary},938:function(r,n,o){Object.defineProperty(n,"__esModule",{value:!0}),n.invoke=void 0;var a=o(934);n.invoke=function(c,d){if(c.requestStream)throw new Error(".invoke cannot be used with client-streaming methods. Use .client instead.");var l=a.client(c,{host:d.host,transport:d.transport,debug:d.debug});return d.onHeaders&&l.onHeaders(d.onHeaders),d.onMessage&&l.onMessage(d.onMessage),d.onEnd&&l.onEnd(d.onEnd),l.start(d.metadata),l.send(d.request),l.finishSend(),{close:function(){l.close()}}}},65:function(r,n,o){Object.defineProperty(n,"__esModule",{value:!0}),n.Metadata=void 0;var a=o(418);Object.defineProperty(n,"Metadata",{enumerable:!0,get:function(){return a.BrowserHeaders}})},57:function(r,n,o){Object.defineProperty(n,"__esModule",{value:!0}),n.makeDefaultTransport=n.setDefaultTransportFactory=void 0;var a=o(859),c=function(d){return a.CrossBrowserHttpTransport({withCredentials:!1})(d)};n.setDefaultTransportFactory=function(d){c=d},n.makeDefaultTransport=function(d){return c(d)}},229:function(r,n,o){var a=this&&this.__assign||function(){return(a=Object.assign||function(u){for(var p,h=1,g=arguments.length;h<g;h++)for(var f in p=arguments[h])Object.prototype.hasOwnProperty.call(p,f)&&(u[f]=p[f]);return u}).apply(this,arguments)};Object.defineProperty(n,"__esModule",{value:!0}),n.detectFetchSupport=n.FetchReadableStreamTransport=void 0;var c=o(65),d=o(346);n.FetchReadableStreamTransport=function(u){return function(p){return(function(h,g){return h.debug&&d.debug("fetchRequest",h),new l(h,g)})(p,u)}};var l=(function(){function u(p,h){this.cancelled=!1,this.controller=self.AbortController&&new AbortController,this.options=p,this.init=h}return u.prototype.pump=function(p,h){var g=this;if(this.reader=p,this.cancelled)return this.options.debug&&d.debug("Fetch.pump.cancel at first pump"),void this.reader.cancel().catch((function(f){g.options.debug&&d.debug("Fetch.pump.reader.cancel exception",f)}));this.reader.read().then((function(f){if(f.done)return g.options.onEnd(),h;g.options.onChunk(f.value),g.pump(g.reader,h)})).catch((function(f){g.cancelled?g.options.debug&&d.debug("Fetch.catch - request cancelled"):(g.cancelled=!0,g.options.debug&&d.debug("Fetch.catch",f.message),g.options.onEnd(f))}))},u.prototype.send=function(p){var h=this;fetch(this.options.url,a(a({},this.init),{headers:this.metadata.toHeaders(),method:"POST",body:p,signal:this.controller&&this.controller.signal})).then((function(g){if(h.options.debug&&d.debug("Fetch.response",g),h.options.onHeaders(new c.Metadata(g.headers),g.status),!g.body)return g;h.pump(g.body.getReader(),g)})).catch((function(g){h.cancelled?h.options.debug&&d.debug("Fetch.catch - request cancelled"):(h.cancelled=!0,h.options.debug&&d.debug("Fetch.catch",g.message),h.options.onEnd(g))}))},u.prototype.sendMessage=function(p){this.send(p)},u.prototype.finishSend=function(){},u.prototype.start=function(p){this.metadata=p},u.prototype.cancel=function(){var p=this;this.cancelled?this.options.debug&&d.debug("Fetch.cancel already cancelled"):(this.cancelled=!0,this.controller?(this.options.debug&&d.debug("Fetch.cancel.controller.abort"),this.controller.abort()):this.options.debug&&d.debug("Fetch.cancel.missing abort controller"),this.reader?(this.options.debug&&d.debug("Fetch.cancel.reader.cancel"),this.reader.cancel().catch((function(h){p.options.debug&&d.debug("Fetch.cancel.reader.cancel exception",h)}))):this.options.debug&&d.debug("Fetch.cancel before reader"))},u})();n.detectFetchSupport=function(){return typeof Response<"u"&&Response.prototype.hasOwnProperty("body")&&typeof Headers=="function"}},859:function(r,n,o){Object.defineProperty(n,"__esModule",{value:!0}),n.CrossBrowserHttpTransport=void 0;var a=o(229),c=o(210);n.CrossBrowserHttpTransport=function(d){if(a.detectFetchSupport()){var l={credentials:d.withCredentials?"include":"same-origin"};return a.FetchReadableStreamTransport(l)}return c.XhrTransport({withCredentials:d.withCredentials})}},210:function(r,n,o){var a,c=this&&this.__extends||(a=function(m,b){return(a=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(v,y){v.__proto__=y}||function(v,y){for(var w in y)Object.prototype.hasOwnProperty.call(y,w)&&(v[w]=y[w])})(m,b)},function(m,b){function v(){this.constructor=m}a(m,b),m.prototype=b===null?Object.create(b):(v.prototype=b.prototype,new v)});Object.defineProperty(n,"__esModule",{value:!0}),n.stringToArrayBuffer=n.MozChunkedArrayBufferXHR=n.XHR=n.XhrTransport=void 0;var d=o(65),l=o(346),u=o(849);n.XhrTransport=function(m){return function(b){if(u.detectMozXHRSupport())return new h(b,m);if(u.detectXHROverrideMimeTypeSupport())return new p(b,m);throw new Error("This environment's XHR implementation cannot support binary transfer.")}};var p=(function(){function m(b,v){this.options=b,this.init=v}return m.prototype.onProgressEvent=function(){this.options.debug&&l.debug("XHR.onProgressEvent.length: ",this.xhr.response.length);var b=this.xhr.response.substr(this.index);this.index=this.xhr.response.length;var v=f(b);this.options.onChunk(v)},m.prototype.onLoadEvent=function(){this.options.debug&&l.debug("XHR.onLoadEvent"),this.options.onEnd()},m.prototype.onStateChange=function(){this.options.debug&&l.debug("XHR.onStateChange",this.xhr.readyState),this.xhr.readyState===XMLHttpRequest.HEADERS_RECEIVED&&this.options.onHeaders(new d.Metadata(this.xhr.getAllResponseHeaders()),this.xhr.status)},m.prototype.sendMessage=function(b){this.xhr.send(b)},m.prototype.finishSend=function(){},m.prototype.start=function(b){var v=this;this.metadata=b;var y=new XMLHttpRequest;this.xhr=y,y.open("POST",this.options.url),this.configureXhr(),this.metadata.forEach((function(w,C){y.setRequestHeader(w,C.join(", "))})),y.withCredentials=!!this.init.withCredentials,y.addEventListener("readystatechange",this.onStateChange.bind(this)),y.addEventListener("progress",this.onProgressEvent.bind(this)),y.addEventListener("loadend",this.onLoadEvent.bind(this)),y.addEventListener("error",(function(w){v.options.debug&&l.debug("XHR.error",w),v.options.onEnd(w.error)}))},m.prototype.configureXhr=function(){this.xhr.responseType="text",this.xhr.overrideMimeType("text/plain; charset=x-user-defined")},m.prototype.cancel=function(){this.options.debug&&l.debug("XHR.abort"),this.xhr.abort()},m})();n.XHR=p;var h=(function(m){function b(){return m!==null&&m.apply(this,arguments)||this}return c(b,m),b.prototype.configureXhr=function(){this.options.debug&&l.debug("MozXHR.configureXhr: setting responseType to 'moz-chunked-arraybuffer'"),this.xhr.responseType="moz-chunked-arraybuffer"},b.prototype.onProgressEvent=function(){var v=this.xhr.response;this.options.debug&&l.debug("MozXHR.onProgressEvent: ",new Uint8Array(v)),this.options.onChunk(new Uint8Array(v))},b})(p);function g(m,b){var v=m.charCodeAt(b);if(v>=55296&&v<=56319){var y=m.charCodeAt(b+1);y>=56320&&y<=57343&&(v=65536+(v-55296<<10)+(y-56320))}return v}function f(m){for(var b=new Uint8Array(m.length),v=0,y=0;y<m.length;y++){var w=String.prototype.codePointAt?m.codePointAt(y):g(m,y);b[v++]=255&w}return b}n.MozChunkedArrayBufferXHR=h,n.stringToArrayBuffer=f},849:function(r,n){var o;function a(){if(o!==void 0)return o;if(XMLHttpRequest){o=new XMLHttpRequest;try{o.open("GET","https://localhost")}catch{}}return o}function c(d){var l=a();if(!l)return!1;try{return l.responseType=d,l.responseType===d}catch{}return!1}Object.defineProperty(n,"__esModule",{value:!0}),n.detectXHROverrideMimeTypeSupport=n.detectMozXHRSupport=n.xhrSupportsResponseType=void 0,n.xhrSupportsResponseType=c,n.detectMozXHRSupport=function(){return typeof XMLHttpRequest<"u"&&c("moz-chunked-arraybuffer")},n.detectXHROverrideMimeTypeSupport=function(){return typeof XMLHttpRequest<"u"&&XMLHttpRequest.prototype.hasOwnProperty("overrideMimeType")}},540:function(r,n,o){Object.defineProperty(n,"__esModule",{value:!0}),n.WebsocketTransport=void 0;var a,c=o(346),d=o(617);(function(u){u[u.FINISH_SEND=1]="FINISH_SEND"})(a||(a={}));var l=new Uint8Array([1]);n.WebsocketTransport=function(){return function(u){return(function(p){p.debug&&c.debug("websocketRequest",p);var h,g=(function(b){if(b.substr(0,8)==="https://")return"wss://"+b.substr(8);if(b.substr(0,7)==="http://")return"ws://"+b.substr(7);throw new Error("Websocket transport constructed with non-https:// or http:// host.")})(p.url),f=[];function m(b){if(b===a.FINISH_SEND)h.send(l);else{var v=b,y=new Int8Array(v.byteLength+1);y.set(new Uint8Array([0])),y.set(v,1),h.send(y)}}return{sendMessage:function(b){h&&h.readyState!==h.CONNECTING?m(b):f.push(b)},finishSend:function(){h&&h.readyState!==h.CONNECTING?m(a.FINISH_SEND):f.push(a.FINISH_SEND)},start:function(b){(h=new WebSocket(g,["grpc-websockets"])).binaryType="arraybuffer",h.onopen=function(){var v;p.debug&&c.debug("websocketRequest.onopen"),h.send((v="",b.forEach((function(y,w){v+=y+": "+w.join(", ")+`\r
`})),d.encodeASCII(v))),f.forEach((function(y){m(y)}))},h.onclose=function(v){p.debug&&c.debug("websocketRequest.onclose",v),p.onEnd()},h.onerror=function(v){p.debug&&c.debug("websocketRequest.onerror",v)},h.onmessage=function(v){p.onChunk(new Uint8Array(v.data))}},cancel:function(){p.debug&&c.debug("websocket.abort"),h.close()}}})(u)}}},35:function(r,n,o){Object.defineProperty(n,"__esModule",{value:!0}),n.unary=void 0;var a=o(65),c=o(934);n.unary=function(d,l){if(d.responseStream)throw new Error(".unary cannot be used with server-streaming methods. Use .invoke or .client instead.");if(d.requestStream)throw new Error(".unary cannot be used with client-streaming methods. Use .client instead.");var u=null,p=null,h=c.client(d,{host:l.host,transport:l.transport,debug:l.debug});return h.onHeaders((function(g){u=g})),h.onMessage((function(g){p=g})),h.onEnd((function(g,f,m){l.onEnd({status:g,statusMessage:f,headers:u||new a.Metadata,message:p,trailers:m})})),h.start(l.metadata),h.send(l.request),h.finishSend(),{close:function(){h.close()}}}},882:function(r,n){Object.defineProperty(n,"__esModule",{value:!0}),n.frameRequest=void 0,n.frameRequest=function(o){var a=o.serializeBinary(),c=new ArrayBuffer(a.byteLength+5);return new DataView(c,1,4).setUint32(0,a.length,!1),new Uint8Array(c,5).set(a),new Uint8Array(c)}}},s={},(function r(n){if(s[n])return s[n].exports;var o=s[n]={exports:{}};return i[n].call(o.exports,o,o.exports,r),o.exports})(607);var i,s}))})(Tn)),Tn.exports}var Gs=Q0();class ql extends Error{constructor(t,i){super(i||`gRPC error code ${t}`),this.name="GrpcError",this.code=t}}function ew(e){return e instanceof ql&&e.code===Gs.grpc.Code.Unimplemented}const Hn=class Hn extends EventTarget{constructor(t,i){super(),this.status="disconnected",this.sequence=0n,this.attempt=0,this.abortController=null,this.heartbeatTimer=null,this.reconnectTimer=null,this.client=t,this.store=i}get connectionStatus(){return this.status}async start(){this.stop(),this.connect()}stop(){var t;(t=this.abortController)==null||t.abort(),this.abortController=null,this.clearHeartbeat(),this.clearReconnect(),this.setStatus("disconnected")}async connect(){var t,i,s;this.abortController=new AbortController,this.setStatus("connecting");try{this.setStatus("syncing");for await(const r of this.client.watchTasks(this.abortController.signal)){if((t=this.abortController)!=null&&t.signal.aborted)break;if(this.resetHeartbeat(),r.sequence!==this.sequence+1n&&this.sequence!==0n){console.warn(`Sequence gap: expected ${this.sequence+1n}, got ${r.sequence}. Resyncing.`),this.resync();return}this.sequence=r.sequence,r.eventType===En.SNAPSHOT_COMPLETE?(this.store.snapshotComplete(),this.attempt=0,this.setStatus("live")):r.eventType===En.HEARTBEAT||(r.eventType===En.DELETED?this.store.delete(r.task.id):this.store.upsert(r.task,r.changes))}(i=this.abortController)!=null&&i.signal.aborted||this.scheduleReconnect()}catch(r){if((s=this.abortController)!=null&&s.signal.aborted)return;if(ew(r)){console.info("WatchTasks returned Unimplemented — falling back to polling."),this.setStatus("disconnected"),this.dispatchEvent(new CustomEvent("watch-unsupported"));return}console.error("Stream error:",r),this.setStatus("error"),this.scheduleReconnect()}}resync(){this.sequence=0n,this.store.clear(),this.attempt=0,this.scheduleReconnect()}scheduleReconnect(){this.clearReconnect();const t=Math.min(Math.pow(2,this.attempt)*100,3e4),i=Math.random()*t*.1,s=t+i;this.attempt++,this.setStatus("reconnecting"),this.reconnectTimer=setTimeout(()=>this.connect(),s)}resetHeartbeat(){this.clearHeartbeat(),this.heartbeatTimer=setTimeout(()=>{console.warn("Heartbeat timeout — no events for 45s. Reconnecting."),this.resync()},Hn.HEARTBEAT_TIMEOUT)}clearHeartbeat(){this.heartbeatTimer&&(clearTimeout(this.heartbeatTimer),this.heartbeatTimer=null)}clearReconnect(){this.reconnectTimer&&(clearTimeout(this.reconnectTimer),this.reconnectTimer=null)}setStatus(t){this.status!==t&&(this.status=t,this.dispatchEvent(new CustomEvent("status-changed",{detail:{status:t}})))}};Hn.HEARTBEAT_TIMEOUT=45e3;let Hl=Hn;const Vn=class Vn extends EventTarget{constructor(t,i,s=Vn.DEFAULT_INTERVAL_MS){super(),this.status="idle",this.timer=null,this._lastRefreshed=null,this._isRefreshing=!1,this.pollToken=0,this.dirtyTasks=new Map,this.client=t,this.store=i,this.intervalMs=s}get pollStatus(){return this.status}get lastRefreshed(){return this._lastRefreshed}get isRefreshing(){return this._isRefreshing}markDirty(t){this.dirtyTasks.set(t,(this.dirtyTasks.get(t)??0)+1)}clearDirty(t){const i=(this.dirtyTasks.get(t)??0)-1;i<=0?this.dirtyTasks.delete(t):this.dirtyTasks.set(t,i)}async start(){this.stop(),await this.refresh(),this.timer=setInterval(()=>void this.refresh(),this.intervalMs)}setInterval(t){this.intervalMs=t,this.timer!==null&&(clearInterval(this.timer),this.timer=setInterval(()=>void this.refresh(),this.intervalMs))}stop(){this.timer!==null&&(clearInterval(this.timer),this.timer=null),this.pollToken++,this._isRefreshing=!1,this.setStatus("idle")}async refresh(){if(this._isRefreshing)return;const t=++this.pollToken;this._isRefreshing=!0,this.setStatus("polling"),this.dispatchEvent(new CustomEvent("refresh-start"));try{const i=await this.client.listTasks();if(t!==this.pollToken)return;const s=new Set;let r=!1;for(const n of i)s.add(n.id),this.dirtyTasks.has(n.id)||this.store.upsert(n)&&(r=!0);for(const n of this.store.allTasks)!s.has(n.id)&&!this.dirtyTasks.has(n.id)&&(this.store.delete(n.id),r=!0);(r||this.store.isLoading)&&this.store.snapshotComplete(),this._lastRefreshed=new Date,this._isRefreshing=!1,this.setStatus("idle"),this.dispatchEvent(new CustomEvent("refresh-end",{detail:{lastRefreshed:this._lastRefreshed}}))}catch(i){if(t!==this.pollToken)return;console.error("Poll refresh failed:",i),this._isRefreshing=!1,this.setStatus("error"),this.dispatchEvent(new CustomEvent("refresh-error",{detail:{error:i}}))}}setStatus(t){this.status!==t&&(this.status=t,this.dispatchEvent(new CustomEvent("status-changed",{detail:{status:t}})))}};Vn.DEFAULT_INTERVAL_MS=3e4;let Nr=Vn;var mn={exports:{}},gn={exports:{}},Da={},bn={},Na,qu;function Yp(){if(qu)return Na;qu=1,Na=e;function e(t,i){for(var s=new Array(arguments.length-1),r=0,n=2,o=!0;n<arguments.length;)s[r++]=arguments[n++];return new Promise(function(c,d){s[r]=function(u){if(o)if(o=!1,u)d(u);else{for(var p=new Array(arguments.length-1),h=0;h<p.length;)p[h++]=arguments[h];c.apply(null,p)}};try{t.apply(i||null,s)}catch(l){o&&(o=!1,d(l))}})}return Na}var La={},Hu;function tw(){return Hu||(Hu=1,(function(e){var t=e;t.length=function(l){var u=l.length;if(!u)return 0;for(;u>0&&l.charAt(u-1)==="=";)--u;return Math.floor(u*3/4)};for(var i=new Array(64),s=new Array(123),r=0;r<64;)s[i[r]=r<26?r+65:r<52?r+71:r<62?r-4:r-59|43]=r++;s[45]=62,s[95]=63,t.encode=function(l,u,p){for(var h=null,g=[],f=0,m=0,b;u<p;){var v=l[u++];switch(m){case 0:g[f++]=i[v>>2],b=(v&3)<<4,m=1;break;case 1:g[f++]=i[b|v>>4],b=(v&15)<<2,m=2;break;case 2:g[f++]=i[b|v>>6],g[f++]=i[v&63],m=0;break}f>8191&&((h||(h=[])).push(String.fromCharCode.apply(String,g)),f=0)}return m&&(g[f++]=i[b],g[f++]=61,m===1&&(g[f++]=61)),h?(f&&h.push(String.fromCharCode.apply(String,g.slice(0,f))),h.join("")):String.fromCharCode.apply(String,g.slice(0,f))};var n="invalid encoding";t.decode=function(l,u,p){for(var h=p,g=0,f,m=0;m<l.length;){var b=l.charCodeAt(m++);if(b===61&&g>1)break;if((b=s[b])===void 0)throw Error(n);switch(g){case 0:f=b,g=1;break;case 1:u[p++]=f<<2|(b&48)>>4,f=b,g=2;break;case 2:u[p++]=(f&15)<<4|(b&60)>>2,f=b,g=3;break;case 3:u[p++]=(f&3)<<6|b,g=0;break}}if(g===1)throw Error(n);return p-h};var o=/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,a=/[-_]/,c=/^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2}(?:==)?|[A-Za-z0-9_-]{3}=?)?$/;t.test=function(l){return o.test(l)||a.test(l)&&c.test(l)}})(La)),La}var Pa,Vu;function iw(){if(Vu)return Pa;Vu=1,Pa=e;function e(){this._listeners=Object.create(null)}return e.prototype.on=function(i,s,r){return(this._listeners[i]||(this._listeners[i]=[])).push({fn:s,ctx:r||this}),this},e.prototype.off=function(i,s){if(i===void 0)this._listeners=Object.create(null);else if(s===void 0)this._listeners[i]=[];else{var r=this._listeners[i];if(!r)return this;for(var n=0;n<r.length;)r[n].fn===s?r.splice(n,1):++n}return this},e.prototype.emit=function(i){var s=this._listeners[i];if(s){for(var r=[],n=1;n<arguments.length;)r.push(arguments[n++]);for(n=0;n<s.length;)s[n].fn.apply(s[n++].ctx,r)}return this},Pa}var Ma,ju;function sw(){if(ju)return Ma;ju=1,Ma=e(e);function e(n){return typeof Float32Array<"u"?(function(){var o=new Float32Array([-0]),a=new Uint8Array(o.buffer),c=a[3]===128;function d(h,g,f){o[0]=h,g[f]=a[0],g[f+1]=a[1],g[f+2]=a[2],g[f+3]=a[3]}function l(h,g,f){o[0]=h,g[f]=a[3],g[f+1]=a[2],g[f+2]=a[1],g[f+3]=a[0]}n.writeFloatLE=c?d:l,n.writeFloatBE=c?l:d;function u(h,g){return a[0]=h[g],a[1]=h[g+1],a[2]=h[g+2],a[3]=h[g+3],o[0]}function p(h,g){return a[3]=h[g],a[2]=h[g+1],a[1]=h[g+2],a[0]=h[g+3],o[0]}n.readFloatLE=c?u:p,n.readFloatBE=c?p:u})():(function(){function o(c,d,l,u){var p=d<0?1:0;if(p&&(d=-d),d===0)c(1/d>0?0:2147483648,l,u);else if(isNaN(d))c(2143289344,l,u);else if(d>34028234663852886e22)c((p<<31|2139095040)>>>0,l,u);else if(d<11754943508222875e-54)c((p<<31|Math.round(d/1401298464324817e-60))>>>0,l,u);else{var h=Math.floor(Math.log(d)/Math.LN2),g=Math.round(d*Math.pow(2,-h)*8388608)&8388607;c((p<<31|h+127<<23|g)>>>0,l,u)}}n.writeFloatLE=o.bind(null,t),n.writeFloatBE=o.bind(null,i);function a(c,d,l){var u=c(d,l),p=(u>>31)*2+1,h=u>>>23&255,g=u&8388607;return h===255?g?NaN:p*(1/0):h===0?p*1401298464324817e-60*g:p*Math.pow(2,h-150)*(g+8388608)}n.readFloatLE=a.bind(null,s),n.readFloatBE=a.bind(null,r)})(),typeof Float64Array<"u"?(function(){var o=new Float64Array([-0]),a=new Uint8Array(o.buffer),c=a[7]===128;function d(h,g,f){o[0]=h,g[f]=a[0],g[f+1]=a[1],g[f+2]=a[2],g[f+3]=a[3],g[f+4]=a[4],g[f+5]=a[5],g[f+6]=a[6],g[f+7]=a[7]}function l(h,g,f){o[0]=h,g[f]=a[7],g[f+1]=a[6],g[f+2]=a[5],g[f+3]=a[4],g[f+4]=a[3],g[f+5]=a[2],g[f+6]=a[1],g[f+7]=a[0]}n.writeDoubleLE=c?d:l,n.writeDoubleBE=c?l:d;function u(h,g){return a[0]=h[g],a[1]=h[g+1],a[2]=h[g+2],a[3]=h[g+3],a[4]=h[g+4],a[5]=h[g+5],a[6]=h[g+6],a[7]=h[g+7],o[0]}function p(h,g){return a[7]=h[g],a[6]=h[g+1],a[5]=h[g+2],a[4]=h[g+3],a[3]=h[g+4],a[2]=h[g+5],a[1]=h[g+6],a[0]=h[g+7],o[0]}n.readDoubleLE=c?u:p,n.readDoubleBE=c?p:u})():(function(){function o(c,d,l,u,p,h){var g=u<0?1:0;if(g&&(u=-u),u===0)c(0,p,h+d),c(1/u>0?0:2147483648,p,h+l);else if(isNaN(u))c(0,p,h+d),c(2146959360,p,h+l);else if(u>17976931348623157e292)c(0,p,h+d),c((g<<31|2146435072)>>>0,p,h+l);else{var f;if(u<22250738585072014e-324)f=u/5e-324,c(f>>>0,p,h+d),c((g<<31|f/4294967296)>>>0,p,h+l);else{var m=Math.floor(Math.log(u)/Math.LN2);m===1024&&(m=1023),f=u*Math.pow(2,-m),c(f*4503599627370496>>>0,p,h+d),c((g<<31|m+1023<<20|f*1048576&1048575)>>>0,p,h+l)}}}n.writeDoubleLE=o.bind(null,t,0,4),n.writeDoubleBE=o.bind(null,i,4,0);function a(c,d,l,u,p){var h=c(u,p+d),g=c(u,p+l),f=(g>>31)*2+1,m=g>>>20&2047,b=4294967296*(g&1048575)+h;return m===2047?b?NaN:f*(1/0):m===0?f*5e-324*b:f*Math.pow(2,m-1075)*(b+4503599627370496)}n.readDoubleLE=a.bind(null,s,0,4),n.readDoubleBE=a.bind(null,r,4,0)})(),n}function t(n,o,a){o[a]=n&255,o[a+1]=n>>>8&255,o[a+2]=n>>>16&255,o[a+3]=n>>>24}function i(n,o,a){o[a]=n>>>24,o[a+1]=n>>>16&255,o[a+2]=n>>>8&255,o[a+3]=n&255}function s(n,o){return(n[o]|n[o+1]<<8|n[o+2]<<16|n[o+3]<<24)>>>0}function r(n,o){return(n[o]<<24|n[o+1]<<16|n[o+2]<<8|n[o+3])>>>0}return Ma}var Fa={},Gu;function rw(){return Gu||(Gu=1,(function(e){var t=e,i="�",s=new TextDecoder("utf-8",{ignoreBOM:!0}),r,n=64;try{r=new TextDecoder("utf-8",{fatal:!0,ignoreBOM:!0})}catch{r=s}t.length=function(d){for(var l=0,u=0,p=0;p<d.length;++p)u=d.charCodeAt(p),u<128?l+=1:u<2048?l+=2:(u&64512)===55296&&(d.charCodeAt(p+1)&64512)===56320?(++p,l+=4):l+=3;return l};function o(c,d,l,u){for(var p=d;p<l;){var h=c[p++];if(h<=127)u+=String.fromCharCode(h);else if(h>=192&&h<224){var g=(h&31)<<6|c[p++]&63;u+=g>=128?String.fromCharCode(g):i}else if(h>=224&&h<240){var f=(h&15)<<12|(c[p++]&63)<<6|c[p++]&63;u+=f>=2048?String.fromCharCode(f):i}else if(h>=240){var m=(h&7)<<18|(c[p++]&63)<<12|(c[p++]&63)<<6|c[p++]&63;m<65536||m>1114111?u+=i:(m-=65536,u+=String.fromCharCode(55296+(m>>10)),u+=String.fromCharCode(56320+(m&1023)))}}return u}function a(c,d,l,u){var p=l===0&&u===d.length?d:d.subarray(l,u);return c.decode(p)}t.read=function(d,l,u){if(u-l<1)return"";if(u-l>=n)return a(s,d,l,u);for(var p="",h=l,g,f,m,b,v,y,w,C;h+7<u;h+=8){if(g=d[h],f=d[h+1],m=d[h+2],b=d[h+3],v=d[h+4],y=d[h+5],w=d[h+6],C=d[h+7],(g|f|m|b|v|y|w|C)&128)return o(d,h,u,p);p+=String.fromCharCode(g,f,m,b,v,y,w,C)}for(;h<u;++h){if(g=d[h],g&128)return o(d,h,u,p);p+=String.fromCharCode(g)}return p},t.readStrict=function(d,l,u){if(u-l<1)return"";if(u-l>=n)return a(r,d,l,u);for(var p="",h=l,g,f,m,b,v,y,w,C;h+7<u;h+=8){if(g=d[h],f=d[h+1],m=d[h+2],b=d[h+3],v=d[h+4],y=d[h+5],w=d[h+6],C=d[h+7],(g|f|m|b|v|y|w|C)&128)return p+a(r,d,h,u);p+=String.fromCharCode(g,f,m,b,v,y,w,C)}for(;h<u;++h){if(g=d[h],g&128)return p+a(r,d,h,u);p+=String.fromCharCode(g)}return p},t.write=function(d,l,u){for(var p=u,h,g,f=0;f<d.length;++f)h=d.charCodeAt(f),h<128?l[u++]=h:h<2048?(l[u++]=h>>6|192,l[u++]=h&63|128):(h&64512)===55296&&((g=d.charCodeAt(f+1))&64512)===56320?(h=65536+((h&1023)<<10)+(g&1023),++f,l[u++]=h>>18|240,l[u++]=h>>12&63|128,l[u++]=h>>6&63|128,l[u++]=h&63|128):(l[u++]=h>>12|224,l[u++]=h>>6&63|128,l[u++]=h&63|128);return u-p}})(Fa)),Fa}var za,Wu;function nw(){if(Wu)return za;Wu=1,za=e;function e(t,i,s){var r=s||8192,n=r>>>1,o=null,a=r;return function(d){if(d<1||d>n)return t(d);a+d>r&&(o=t(r),a=0);var l=i.call(o,a,a+=d);return a&7&&(a=(a|7)+1),l}}return za}var Ba,Yu;function ow(){if(Yu)return Ba;Yu=1,Ba=t;var e=Ri();function t(n,o){this.lo=n>>>0,this.hi=o>>>0}var i=t.zero=new t(0,0);i.toNumber=function(){return 0},i.zzEncode=i.zzDecode=function(){return this},i.length=function(){return 1};var s=t.zeroHash="\0\0\0\0\0\0\0\0";t.fromNumber=function(o){if(o===0)return i;var a=o<0;a&&(o=-o);var c=o>>>0,d=(o-c)/4294967296>>>0;return a&&(d=~d>>>0,c=~c>>>0,++c>4294967295&&(c=0,++d>4294967295&&(d=0))),new t(c,d)},t.from=function(o){if(typeof o=="number")return t.fromNumber(o);if(e.isString(o))if(e.Long)o=e.Long.fromString(o);else return t.fromNumber(parseInt(o,10));return o.low||o.high?new t(o.low>>>0,o.high>>>0):i},t.prototype.toNumber=function(o){if(!o&&this.hi>>>31){var a=~this.lo+1>>>0,c=~this.hi>>>0;return a||(c=c+1>>>0),-(a+c*4294967296)}return this.lo+this.hi*4294967296},t.prototype.toLong=function(o){return e.Long?new e.Long(this.lo|0,this.hi|0,!!o):{low:this.lo|0,high:this.hi|0,unsigned:!!o}};var r=String.prototype.charCodeAt;return t.fromHash=function(o){return o===s?i:new t((r.call(o,0)|r.call(o,1)<<8|r.call(o,2)<<16|r.call(o,3)<<24)>>>0,(r.call(o,4)|r.call(o,5)<<8|r.call(o,6)<<16|r.call(o,7)<<24)>>>0)},t.prototype.toHash=function(){return String.fromCharCode(this.lo&255,this.lo>>>8&255,this.lo>>>16&255,this.lo>>>24,this.hi&255,this.hi>>>8&255,this.hi>>>16&255,this.hi>>>24)},t.prototype.zzEncode=function(){var o=this.hi>>31;return this.hi=((this.hi<<1|this.lo>>>31)^o)>>>0,this.lo=(this.lo<<1^o)>>>0,this},t.prototype.zzDecode=function(){var o=-(this.lo&1);return this.lo=((this.lo>>>1|this.hi<<31)^o)>>>0,this.hi=(this.hi>>>1^o)>>>0,this},t.prototype.length=function(){var o=this.lo,a=(this.lo>>>28|this.hi<<4)>>>0,c=this.hi>>>24;return c===0?a===0?o<16384?o<128?1:2:o<2097152?3:4:a<16384?a<128?5:6:a<2097152?7:8:c<128?9:10},Ba}var Cr={exports:{}},aw=Cr.exports,Ku;function lw(){return Ku||(Ku=1,(function(e,t){(function(i,s){function r(n){return n.default||n}s(t),e.exports=r(t)})(typeof globalThis<"u"?globalThis:typeof self<"u"?self:aw,function(i){Object.defineProperty(i,"__esModule",{value:!0}),i.default=void 0;/**
 * @license
 * Copyright 2009 The Closure Library Authors
 * Copyright 2020 Daniel Wirtz / The long.js Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */var s=null;try{s=new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0,1,13,2,96,0,1,127,96,4,127,127,127,127,1,127,3,7,6,0,1,1,1,1,1,6,6,1,127,1,65,0,11,7,50,6,3,109,117,108,0,1,5,100,105,118,95,115,0,2,5,100,105,118,95,117,0,3,5,114,101,109,95,115,0,4,5,114,101,109,95,117,0,5,8,103,101,116,95,104,105,103,104,0,0,10,191,1,6,4,0,35,0,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,126,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,127,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,128,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,129,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,130,34,4,66,32,135,167,36,0,32,4,167,11])),{}).exports}catch{}function r(I,_,$){this.low=I|0,this.high=_|0,this.unsigned=!!$}r.prototype.__isLong__,Object.defineProperty(r.prototype,"__isLong__",{value:!0});function n(I){return(I&&I.__isLong__)===!0}function o(I){var _=Math.clz32(I&-I);return I?31-_:_}r.isLong=n;var a={},c={};function d(I,_){var $,Y,ie;return _?(I>>>=0,(ie=0<=I&&I<256)&&(Y=c[I],Y)?Y:($=u(I,0,!0),ie&&(c[I]=$),$)):(I|=0,(ie=-128<=I&&I<128)&&(Y=a[I],Y)?Y:($=u(I,I<0?-1:0,!1),ie&&(a[I]=$),$))}r.fromInt=d;function l(I,_){if(isNaN(I))return _?O:C;if(_){if(I<0)return O;if(I>=v)return F}else{if(I<=-y)return P;if(I+1>=y)return D}return I<0?l(-I,_).neg():u(I%b|0,I/b|0,_)}r.fromNumber=l;function u(I,_,$){return new r(I,_,$)}r.fromBits=u;var p=Math.pow;function h(I,_,$){if(I.length===0)throw Error("empty string");if(typeof _=="number"?($=_,_=!1):_=!!_,I==="NaN"||I==="Infinity"||I==="+Infinity"||I==="-Infinity")return _?O:C;if($=$||10,$<2||36<$)throw RangeError("radix");var Y;if((Y=I.indexOf("-"))>0)throw Error("interior hyphen");if(Y===0)return h(I.substring(1),_,$).neg();for(var ie=l(p($,8)),oe=C,_e=0;_e<I.length;_e+=8){var ae=Math.min(8,I.length-_e),de=parseInt(I.substring(_e,_e+ae),$);if(ae<8){var N=l(p($,ae));oe=oe.mul(N).add(l(de))}else oe=oe.mul(ie),oe=oe.add(l(de))}return oe.unsigned=_,oe}r.fromString=h;function g(I,_){return typeof I=="number"?l(I,_):typeof I=="string"?h(I,_):u(I.low,I.high,typeof _=="boolean"?_:I.unsigned)}r.fromValue=g;var f=65536,m=1<<24,b=f*f,v=b*b,y=v/2,w=d(m),C=d(0);r.ZERO=C;var O=d(0,!0);r.UZERO=O;var M=d(1);r.ONE=M;var A=d(1,!0);r.UONE=A;var R=d(-1);r.NEG_ONE=R;var D=u(-1,2147483647,!1);r.MAX_VALUE=D;var F=u(-1,-1,!0);r.MAX_UNSIGNED_VALUE=F;var P=u(0,-2147483648,!1);r.MIN_VALUE=P;var S=r.prototype;S.toInt=function(){return this.unsigned?this.low>>>0:this.low},S.toNumber=function(){return this.unsigned?(this.high>>>0)*b+(this.low>>>0):this.high*b+(this.low>>>0)},S.toString=function(_){if(_=_||10,_<2||36<_)throw RangeError("radix");if(this.isZero())return"0";if(this.isNegative())if(this.eq(P)){var $=l(_),Y=this.div($),ie=Y.mul($).sub(this);return Y.toString(_)+ie.toInt().toString(_)}else return"-"+this.neg().toString(_);for(var oe=l(p(_,6),this.unsigned),_e=this,ae="";;){var de=_e.div(oe),N=_e.sub(de.mul(oe)).toInt()>>>0,z=N.toString(_);if(_e=de,_e.isZero())return z+ae;for(;z.length<6;)z="0"+z;ae=""+z+ae}},S.getHighBits=function(){return this.high},S.getHighBitsUnsigned=function(){return this.high>>>0},S.getLowBits=function(){return this.low},S.getLowBitsUnsigned=function(){return this.low>>>0},S.getNumBitsAbs=function(){if(this.isNegative())return this.eq(P)?64:this.neg().getNumBitsAbs();for(var _=this.high!=0?this.high:this.low,$=31;$>0&&(_&1<<$)==0;$--);return this.high!=0?$+33:$+1},S.isSafeInteger=function(){var _=this.high>>21;return _?this.unsigned?!1:_===-1&&!(this.low===0&&this.high===-2097152):!0},S.isZero=function(){return this.high===0&&this.low===0},S.eqz=S.isZero,S.isNegative=function(){return!this.unsigned&&this.high<0},S.isPositive=function(){return this.unsigned||this.high>=0},S.isOdd=function(){return(this.low&1)===1},S.isEven=function(){return(this.low&1)===0},S.equals=function(_){return n(_)||(_=g(_)),this.unsigned!==_.unsigned&&this.high>>>31===1&&_.high>>>31===1?!1:this.high===_.high&&this.low===_.low},S.eq=S.equals,S.notEquals=function(_){return!this.eq(_)},S.neq=S.notEquals,S.ne=S.notEquals,S.lessThan=function(_){return this.comp(_)<0},S.lt=S.lessThan,S.lessThanOrEqual=function(_){return this.comp(_)<=0},S.lte=S.lessThanOrEqual,S.le=S.lessThanOrEqual,S.greaterThan=function(_){return this.comp(_)>0},S.gt=S.greaterThan,S.greaterThanOrEqual=function(_){return this.comp(_)>=0},S.gte=S.greaterThanOrEqual,S.ge=S.greaterThanOrEqual,S.compare=function(_){if(n(_)||(_=g(_)),this.eq(_))return 0;var $=this.isNegative(),Y=_.isNegative();return $&&!Y?-1:!$&&Y?1:this.unsigned?_.high>>>0>this.high>>>0||_.high===this.high&&_.low>>>0>this.low>>>0?-1:1:this.sub(_).isNegative()?-1:1},S.comp=S.compare,S.negate=function(){return!this.unsigned&&this.eq(P)?P:this.not().add(M)},S.neg=S.negate,S.add=function(_){n(_)||(_=g(_));var $=this.high>>>16,Y=this.high&65535,ie=this.low>>>16,oe=this.low&65535,_e=_.high>>>16,ae=_.high&65535,de=_.low>>>16,N=_.low&65535,z=0,H=0,K=0,ce=0;return ce+=oe+N,K+=ce>>>16,ce&=65535,K+=ie+de,H+=K>>>16,K&=65535,H+=Y+ae,z+=H>>>16,H&=65535,z+=$+_e,z&=65535,u(K<<16|ce,z<<16|H,this.unsigned)},S.subtract=function(_){return n(_)||(_=g(_)),this.add(_.neg())},S.sub=S.subtract,S.multiply=function(_){if(this.isZero())return this;if(n(_)||(_=g(_)),s){var $=s.mul(this.low,this.high,_.low,_.high);return u($,s.get_high(),this.unsigned)}if(_.isZero())return this.unsigned?O:C;if(this.eq(P))return _.isOdd()?P:C;if(_.eq(P))return this.isOdd()?P:C;if(this.isNegative())return _.isNegative()?this.neg().mul(_.neg()):this.neg().mul(_).neg();if(_.isNegative())return this.mul(_.neg()).neg();if(this.lt(w)&&_.lt(w))return l(this.toNumber()*_.toNumber(),this.unsigned);var Y=this.high>>>16,ie=this.high&65535,oe=this.low>>>16,_e=this.low&65535,ae=_.high>>>16,de=_.high&65535,N=_.low>>>16,z=_.low&65535,H=0,K=0,ce=0,X=0;return X+=_e*z,ce+=X>>>16,X&=65535,ce+=oe*z,K+=ce>>>16,ce&=65535,ce+=_e*N,K+=ce>>>16,ce&=65535,K+=ie*z,H+=K>>>16,K&=65535,K+=oe*N,H+=K>>>16,K&=65535,K+=_e*de,H+=K>>>16,K&=65535,H+=Y*z+ie*N+oe*de+_e*ae,H&=65535,u(ce<<16|X,H<<16|K,this.unsigned)},S.mul=S.multiply,S.divide=function(_){if(n(_)||(_=g(_)),_.isZero())throw Error("division by zero");if(s){if(!this.unsigned&&this.high===-2147483648&&_.low===-1&&_.high===-1)return this;var $=(this.unsigned?s.div_u:s.div_s)(this.low,this.high,_.low,_.high);return u($,s.get_high(),this.unsigned)}if(this.isZero())return this.unsigned?O:C;var Y,ie,oe;if(this.unsigned){if(_.unsigned||(_=_.toUnsigned()),_.gt(this))return O;if(_.gt(this.shru(1)))return A;oe=O}else{if(this.eq(P)){if(_.eq(M)||_.eq(R))return P;if(_.eq(P))return M;var _e=this.shr(1);return Y=_e.div(_).shl(1),Y.eq(C)?_.isNegative()?M:R:(ie=this.sub(_.mul(Y)),oe=Y.add(ie.div(_)),oe)}else if(_.eq(P))return this.unsigned?O:C;if(this.isNegative())return _.isNegative()?this.neg().div(_.neg()):this.neg().div(_).neg();if(_.isNegative())return this.div(_.neg()).neg();oe=C}for(ie=this;ie.gte(_);){Y=Math.max(1,Math.floor(ie.toNumber()/_.toNumber()));for(var ae=Math.ceil(Math.log(Y)/Math.LN2),de=ae<=48?1:p(2,ae-48),N=l(Y),z=N.mul(_);z.isNegative()||z.gt(ie);)Y-=de,N=l(Y,this.unsigned),z=N.mul(_);N.isZero()&&(N=M),oe=oe.add(N),ie=ie.sub(z)}return oe},S.div=S.divide,S.modulo=function(_){if(n(_)||(_=g(_)),s){var $=(this.unsigned?s.rem_u:s.rem_s)(this.low,this.high,_.low,_.high);return u($,s.get_high(),this.unsigned)}return this.sub(this.div(_).mul(_))},S.mod=S.modulo,S.rem=S.modulo,S.not=function(){return u(~this.low,~this.high,this.unsigned)},S.countLeadingZeros=function(){return this.high?Math.clz32(this.high):Math.clz32(this.low)+32},S.clz=S.countLeadingZeros,S.countTrailingZeros=function(){return this.low?o(this.low):o(this.high)+32},S.ctz=S.countTrailingZeros,S.and=function(_){return n(_)||(_=g(_)),u(this.low&_.low,this.high&_.high,this.unsigned)},S.or=function(_){return n(_)||(_=g(_)),u(this.low|_.low,this.high|_.high,this.unsigned)},S.xor=function(_){return n(_)||(_=g(_)),u(this.low^_.low,this.high^_.high,this.unsigned)},S.shiftLeft=function(_){return n(_)&&(_=_.toInt()),(_&=63)===0?this:_<32?u(this.low<<_,this.high<<_|this.low>>>32-_,this.unsigned):u(0,this.low<<_-32,this.unsigned)},S.shl=S.shiftLeft,S.shiftRight=function(_){return n(_)&&(_=_.toInt()),(_&=63)===0?this:_<32?u(this.low>>>_|this.high<<32-_,this.high>>_,this.unsigned):u(this.high>>_-32,this.high>=0?0:-1,this.unsigned)},S.shr=S.shiftRight,S.shiftRightUnsigned=function(_){return n(_)&&(_=_.toInt()),(_&=63)===0?this:_<32?u(this.low>>>_|this.high<<32-_,this.high>>>_,this.unsigned):_===32?u(this.high,0,this.unsigned):u(this.high>>>_-32,0,this.unsigned)},S.shru=S.shiftRightUnsigned,S.shr_u=S.shiftRightUnsigned,S.rotateLeft=function(_){var $;return n(_)&&(_=_.toInt()),(_&=63)===0?this:_===32?u(this.high,this.low,this.unsigned):_<32?($=32-_,u(this.low<<_|this.high>>>$,this.high<<_|this.low>>>$,this.unsigned)):(_-=32,$=32-_,u(this.high<<_|this.low>>>$,this.low<<_|this.high>>>$,this.unsigned))},S.rotl=S.rotateLeft,S.rotateRight=function(_){var $;return n(_)&&(_=_.toInt()),(_&=63)===0?this:_===32?u(this.high,this.low,this.unsigned):_<32?($=32-_,u(this.high<<$|this.low>>>_,this.low<<$|this.high>>>_,this.unsigned)):(_-=32,$=32-_,u(this.low<<$|this.high>>>_,this.high<<$|this.low>>>_,this.unsigned))},S.rotr=S.rotateRight,S.toSigned=function(){return this.unsigned?u(this.low,this.high,!1):this},S.toUnsigned=function(){return this.unsigned?this:u(this.low,this.high,!0)},S.toBytes=function(_){return _?this.toBytesLE():this.toBytesBE()},S.toBytesLE=function(){var _=this.high,$=this.low;return[$&255,$>>>8&255,$>>>16&255,$>>>24,_&255,_>>>8&255,_>>>16&255,_>>>24]},S.toBytesBE=function(){var _=this.high,$=this.low;return[_>>>24,_>>>16&255,_>>>8&255,_&255,$>>>24,$>>>16&255,$>>>8&255,$&255]},r.fromBytes=function(_,$,Y){return Y?r.fromBytesLE(_,$):r.fromBytesBE(_,$)},r.fromBytesLE=function(_,$){return new r(_[0]|_[1]<<8|_[2]<<16|_[3]<<24,_[4]|_[5]<<8|_[6]<<16|_[7]<<24,$)},r.fromBytesBE=function(_,$){return new r(_[4]<<24|_[5]<<16|_[6]<<8|_[7],_[0]<<24|_[1]<<16|_[2]<<8|_[3],$)},typeof BigInt=="function"&&(r.fromBigInt=function(_,$){var Y=Number(BigInt.asIntN(32,_)),ie=Number(BigInt.asIntN(32,_>>BigInt(32)));return u(Y,ie,$)},r.fromValue=function(_,$){return typeof _=="bigint"?r.fromBigInt(_,$):g(_,$)},S.toBigInt=function(){var _=BigInt(this.low>>>0),$=BigInt(this.unsigned?this.high>>>0:this.high);return $<<BigInt(32)|_}),i.default=r})})(Cr,Cr.exports)),Cr.exports}var Xu;function Ri(){return Xu||(Xu=1,(function(e){var t=e;t.asPromise=Yp(),t.base64=tw(),t.EventEmitter=iw(),t.float=sw(),t.utf8=rw(),t.pool=nw(),t.LongBits=ow();function i(n){return n==="__proto__"||n==="prototype"||n==="constructor"}t.isUnsafeProperty=i,t.isNode=!!(typeof Us<"u"&&Us&&Us.process&&Us.process.versions&&Us.process.versions.node),t.global=t.isNode&&Us||typeof window<"u"&&window||typeof self<"u"&&self||typeof globalThis<"u"&&globalThis||bn,t.emptyArray=Object.freeze?Object.freeze([]):[],t.emptyObject=Object.freeze?Object.freeze({}):{},t.isInteger=Number.isInteger||function(o){return typeof o=="number"&&isFinite(o)&&Math.floor(o)===o},t.isString=function(o){return typeof o=="string"||o instanceof String},t.isObject=function(o){return o&&typeof o=="object"},t.isset=t.isSet=function(o,a){var c=o[a];return c!=null&&Object.hasOwnProperty.call(o,a)?typeof c!="object"||(Array.isArray(c)?c.length:Object.keys(c).length)>0:!1},t.Buffer=(function(){try{var n=t.global.Buffer;return n.prototype.utf8Write||t.isNode?n:null}catch{return null}})(),t.newBuffer=function(o){var a=t.Buffer;return typeof o=="number"?a?a.allocUnsafe(o):new Uint8Array(o):a?a.from(o):new Uint8Array(o)},t.rawField=function(o,a,c){var d=[],l=o<<3|a;for(l>>>=0;l>127;)d.push(l&127|128),l>>>=7;d.push(l);for(var u=0;u<c.length;++u)d.push(c[u]);return t.newBuffer(d)},t.Array=Uint8Array,t.Long=t.global.dcodeIO&&t.global.dcodeIO.Long||t.global.Long||(function(){try{var n=lw();return n&&n.isLong?n:null}catch{return null}})(),t.key2Re=/^(?:true|false|0|1)$/,t.key32Re=/^-?(?:0|[1-9][0-9]*)$/,t.key64Re=/^(?:[\x00-\xff]{8}|-?(?:0|[1-9][0-9]*))$/,t.longToHash=function(o){return o?t.LongBits.from(o).toHash():t.LongBits.zeroHash},t.longFromHash=function(o,a){var c=t.LongBits.fromHash(o);return t.Long?t.Long.fromBits(c.lo,c.hi,a):c.toNumber(!!a)},t.longFromKey=function(o,a){return t.key64Re.test(o)&&!t.key32Re.test(o)?t.longFromHash(o,a):o},t.boolFromKey=function(o){return o==="true"||o==="1"};function s(n){var o=typeof arguments[arguments.length-1]=="boolean",a=o?arguments.length-1:arguments.length;o=o&&arguments[arguments.length-1];for(var c=1;c<a;++c){var d=arguments[c];if(d)for(var l=Object.keys(d),u=0;u<l.length;++u)!i(l[u])&&(!o||!Object.prototype.hasOwnProperty.call(n,l[u])||n[l[u]]===void 0)&&(n[l[u]]=d[l[u]])}return n}t.merge=s,t.nestingLimit=32,t.recursionLimit=100,t.makeProp=function(o,a,c){Object.prototype.hasOwnProperty.call(o,a)||Object.defineProperty(o,a,{enumerable:c===void 0?!0:c,configurable:!0,writable:!0})},t.lcFirst=function(o){return o.charAt(0).toLowerCase()+o.substring(1)};function r(n){function o(a,c){if(!(this instanceof o))return new o(a,c);Object.defineProperty(this,"message",{get:function(){return a}}),Error.captureStackTrace?Error.captureStackTrace(this,o):Object.defineProperty(this,"stack",{value:new Error().stack||""}),c&&s(this,c)}return o.prototype=Object.create(Error.prototype,{constructor:{value:o,writable:!0,enumerable:!1,configurable:!0},name:{get:function(){return n},set:void 0,enumerable:!1,configurable:!0},toString:{value:function(){return this.name+": "+this.message},writable:!0,enumerable:!1,configurable:!0}}),o}t.newError=r,t.ProtocolError=r("ProtocolError"),t.oneOfGetter=function(o){for(var a={},c=0;c<o.length;++c)a[o[c]]=1;return function(){for(var d=Object.keys(this),l=d.length-1;l>-1;--l)if(a[d[l]]===1&&this[d[l]]!==void 0&&this[d[l]]!==null)return d[l]}},t.oneOfSetter=function(o){return function(a){for(var c=0;c<o.length;++c)o[c]!==a&&delete this[o[c]]}},t.toJSONOptions={longs:String,enums:String,bytes:String,json:!0}})(bn)),bn}var Ua,Ju;function vc(){if(Ju)return Ua;Ju=1,Ua=n;var e=Ri(),t,i=e.LongBits,s=e.base64,r=e.utf8;function n(){this.pos=0,this.buf=this.constructor.alloc(64),this.view=null,this.states=null}Object.defineProperty(n.prototype,"len",{configurable:!0,enumerable:!0,get:function(){return this.pos}});var o=function(){return e.Buffer?function(){return(n.create=function(){return new t})()}:function(){return new n}};n.create=o(),n.alloc=function(m){return new Uint8Array(m)},n.alloc=e.pool(n.alloc,Uint8Array.prototype.subarray);function a(f){return f<128?1:f<16384?2:f<2097152?3:f<268435456?4:5}n.prototype._reserve=function(m){var b=this.pos+m;if(b>this.buf.length){var v=this.buf.length<<1;v<b&&(v=b);var y=this.constructor.alloc(v);y.set(this.buf.subarray(0,this.pos),0),this.buf=y,this.view=null}};function c(f,m,b){for(var v=0;v<f.length;)m[b++]=f.charCodeAt(v++)}function d(f,m,b){for(;f>127;)m[b++]=f&127|128,f>>>=7;return m[b]=f,b+1}n.prototype.uint32=function(m){m=m>>>0,this._reserve(5);var b=this.pos;return this.pos=d(m,this.buf,b),this},n.prototype.int32=function(m){return(m|=0)<0?(this._reserve(10),l(i.fromNumber(m),this.buf,this.pos),this.pos+=10,this):this.uint32(m)},n.prototype.sint32=function(m){return this.uint32((m<<1^m>>31)>>>0)};function l(f,m,b){for(var v=f.lo,y=f.hi;y;)m[b++]=v&127|128,v=(v>>>7|y<<25)>>>0,y>>>=7;for(;v>127;)m[b++]=v&127|128,v=v>>>7;return m[b]=v,b+1}n.prototype.uint64=function(m){var b=i.from(m);this._reserve(10);var v=this.pos;return this.pos=l(b,this.buf,v),this},n.prototype.int64=n.prototype.uint64,n.prototype.sint64=function(m){var b=i.from(m).zzEncode();this._reserve(10);var v=this.pos;return this.pos=l(b,this.buf,v),this},n.prototype.bool=function(m){return this._reserve(1),this.buf[this.pos++]=m?1:0,this};function u(f,m,b){m[b]=f&255,m[b+1]=f>>>8&255,m[b+2]=f>>>16&255,m[b+3]=f>>>24}n.prototype.fixed32=function(m){return this._reserve(4),u(m>>>0,this.buf,this.pos),this.pos+=4,this},n.prototype.sfixed32=n.prototype.fixed32,n.prototype.fixed64=function(m){var b=i.from(m);return this._reserve(8),u(b.lo,this.buf,this.pos),u(b.hi,this.buf,this.pos+4),this.pos+=8,this},n.prototype.sfixed64=n.prototype.fixed64,n.prototype.float=function(m){return this._reserve(4),e.float.writeFloatLE(m,this.buf,this.pos),this.pos+=4,this},n.prototype.double=function(m){return this._reserve(8),e.float.writeDoubleLE(m,this.buf,this.pos),this.pos+=8,this},n.prototype.bytes=function(m){var b=m.length>>>0;if(!b)return this._reserve(1),this.buf[this.pos++]=0,this;if(e.isString(m)){var v=n.alloc(b=s.length(m));s.decode(m,v,0),m=v}return this.uint32(b),this._reserve(b),this.buf.set(m,this.pos),this.pos+=b,this},n.prototype.raw=function(m){var b=m.length>>>0;return b?(this._reserve(b),this.buf.set(m,this.pos),this.pos+=b,this):this},n.prototype._delim=function(m,b){var v=a(b);return v>1&&this.buf.copyWithin(m+v,m+1,m+1+b),d(b,this.buf,m),this.pos=m+v+b,this},n.prototype.string=function(m){var b=m.length;if(!b)return this._reserve(1),this.buf[this.pos++]=0,this;if(b<128){this._reserve(b*3+5);var v=this.pos;return this._delim(v,r.write(m,this.buf,v+1))}var y=r.length(m);return this.uint32(y),this._reserve(y),y===m.length?c(m,this.buf,this.pos):r.write(m,this.buf,this.pos),this.pos+=y,this},n.prototype.uint32s=function(m){var b=m.length;this._reserve(b*5+5);for(var v=this.buf,y=this.pos,w=y+1,C=0;C<b;++C)w=d(m[C]>>>0,v,w);return this._delim(y,w-y-1)},n.prototype.int32s=function(m){var b=m.length;this._reserve(b*10+5);for(var v=this.buf,y=this.pos,w=y+1,C,O=0;O<b;++O)(C=m[O]|0)<0?w=l(i.fromNumber(C),v,w):w=d(C,v,w);return this._delim(y,w-y-1)},n.prototype.sint32s=function(m){var b=m.length;this._reserve(b*5+5);for(var v=this.buf,y=this.pos,w=y+1,C=0;C<b;++C)w=d((m[C]<<1^m[C]>>31)>>>0,v,w);return this._delim(y,w-y-1)},n.prototype.uint64s=function(m){var b=m.length;this._reserve(b*10+5);for(var v=this.buf,y=this.pos,w=y+1,C=0;C<b;++C)w=l(i.from(m[C]),v,w);return this._delim(y,w-y-1)},n.prototype.int64s=n.prototype.uint64s,n.prototype.sint64s=function(m){var b=m.length;this._reserve(b*10+5);for(var v=this.buf,y=this.pos,w=y+1,C=0;C<b;++C)w=l(i.from(m[C]).zzEncode(),v,w);return this._delim(y,w-y-1)},n.prototype.bools=function(m){var b=m.length;this.uint32(b),this._reserve(b);for(var v=this.buf,y=this.pos,w=0;w<b;++w)v[y++]=m[w]?1:0;return this.pos+=b,this};var p=16,h=128;function g(f,m,b){var v=f.view;if(v||m<b)return v;var y=f.buf;return f.view=new DataView(y.buffer,y.byteOffset,y.byteLength)}return n.prototype.fixed32s=function(m){var b=m.length,v=b*4;this.uint32(v),this._reserve(v);var y=this.pos,w,C=g(this,b,h);if(C)for(w=0;w<b;++w)C.setUint32(y,m[w]>>>0,!0),y+=4;else{var O=this.buf;for(w=0;w<b;++w)u(m[w]>>>0,O,y),y+=4}return this.pos+=v,this},n.prototype.sfixed32s=n.prototype.fixed32s,n.prototype.fixed64s=function(m){var b=m.length,v=b*8;this.uint32(v),this._reserve(v);var y=this.pos,w,C,O=g(this,b,h);if(O)for(w=0;w<b;++w)C=i.from(m[w]),O.setUint32(y,C.lo,!0),O.setUint32(y+4,C.hi,!0),y+=8;else{var M=this.buf;for(w=0;w<b;++w)C=i.from(m[w]),u(C.lo,M,y),u(C.hi,M,y+4),y+=8}return this.pos+=v,this},n.prototype.sfixed64s=n.prototype.fixed64s,n.prototype.floats=function(m){var b=m.length,v=b*4;this.uint32(v),this._reserve(v);var y=this.pos,w,C=g(this,b,p);if(C)for(w=0;w<b;++w)C.setFloat32(y,m[w],!0),y+=4;else{var O=this.buf;for(w=0;w<b;++w)e.float.writeFloatLE(m[w],O,y),y+=4}return this.pos+=v,this},n.prototype.doubles=function(m){var b=m.length,v=b*8;this.uint32(v),this._reserve(v);var y=this.pos,w,C=g(this,b,p);if(C)for(w=0;w<b;++w)C.setFloat64(y,m[w],!0),y+=8;else{var O=this.buf;for(w=0;w<b;++w)e.float.writeDoubleLE(m[w],O,y),y+=8}return this.pos+=v,this},n.prototype.fork=function(){return this._reserve(1),(this.states||(this.states=[])).push(this.pos),this.pos+=1,this},n.prototype.reset=function(){var m=this.states;return m&&m.length?this.pos=m.pop():this.pos=0,this},n.prototype.ldelim=function(){var m=this.states,b,v;if(m&&m.length){var y=m.pop();b=this.pos-y-1,v=a(b),v>1?(this._reserve(v-1),this.buf.copyWithin(y+v,y+1,y+1+b),this.pos+=v-1,d(b,this.buf,y)):this.buf[y]=b}else b=this.pos,v=a(b),this._reserve(v),this.buf.copyWithin(v,0,b),d(b,this.buf,0),this.pos+=v;return this},n.prototype.finish=function(m){if(m)return this.buf.subarray(0,this.pos);var b=this.constructor.alloc(this.pos);return b.set(this.buf.subarray(0,this.pos),0),b},n.prototype.finishInto=function(m,b){return b===void 0&&(b=0),m.set(this.buf.subarray(0,this.pos),b),m},n._configure=function(f){t=f,n.create=o(),t._configure()},Ua}var qa,Zu;function cw(){if(Zu)return qa;Zu=1,qa=i;var e=vc();i.prototype=Object.create(e.prototype,{constructor:{value:i,writable:!0,enumerable:!1,configurable:!0}});var t=Ri();function i(){e.call(this)}var s;return i._configure=function(){i.alloc=t.Buffer&&t.Buffer.allocUnsafe,s=t.Buffer&&t.Buffer.prototype.utf8Write?function(n,o,a){return o.utf8Write(n,a)}:function(n,o,a){return o.write(n,a)}},i.prototype.bytes=function(n){t.isString(n)&&(n=t.Buffer.from(n,"base64"));var o=n.length>>>0;return this.uint32(o),o&&(this._reserve(o),this.buf.set(n,this.pos),this.pos+=o),this},i.prototype.string=function(n){var o=n.length;if(!o)return this._reserve(1),this.buf[this.pos++]=0,this;if(o<128){this._reserve(o*3+5);var a=this.pos,c=this.buf;return this._delim(a,o<40?t.utf8.write(n,c,a+1):s(n,c,a+1))}var d=t.Buffer.byteLength(n);return this.uint32(d),this._reserve(d),s(n,this.buf,this.pos),this.pos+=d,this},i._configure(),qa}var Ha,Qu;function yc(){if(Qu)return Ha;Qu=1,Ha=n;var e=Ri(),t,i=e.LongBits,s=e.utf8;function r(g,f){return RangeError("index out of range: "+g.pos+" + "+(f||1)+" > "+g.len)}function n(g){this.buf=g,this.pos=0,this.len=g.length,this.view=null,this.discardUnknown=n.discardUnknown}function o(g){if(Array.isArray(g)&&(g=new Uint8Array(g)),g instanceof Uint8Array)return new n(g);throw Error("illegal buffer")}var a=function(){return e.Buffer?function(m){return(n.create=function(v){return e.Buffer.isBuffer(v)?new t(v):o(v)})(m)}:o};n.create=a(),n.prototype.raw=function(f,m){return this.buf.subarray(f,m)},n.prototype.uint32=function(){var f=this.buf,m=this.pos,b=(f[m]&127)>>>0;if(f[m++]<128)return this.pos=m,b;if(b=(b|(f[m]&127)<<7)>>>0,f[m++]<128)return this.pos=m,b;if(b=(b|(f[m]&127)<<14)>>>0,f[m++]<128)return this.pos=m,b;if(b=(b|(f[m]&127)<<21)>>>0,f[m++]<128)return this.pos=m,b;if(b=(b|(f[m]&15)<<28)>>>0,f[m++]<128)return this.pos=m,b;for(var v=0;v<5;++v){if(m>=this.len)throw this.pos=m,r(this);if(f[m++]<128)return this.pos=m,b}throw this.pos=m,Error("invalid varint encoding")},n.prototype.tag=function(){var f=this.buf,m=this.pos,b=(f[m]&127)>>>0;if(f[m++]<128)return this.pos=m,b;if(b=(b|(f[m]&127)<<7)>>>0,f[m++]<128)return this.pos=m,b;if(b=(b|(f[m]&127)<<14)>>>0,f[m++]<128)return this.pos=m,b;if(b=(b|(f[m]&127)<<21)>>>0,f[m++]<128)return this.pos=m,b;if(b=(b|(f[m]&15)<<28)>>>0,f[m]<128&&(f[m]&112)===0)return this.pos=m+1,b;throw this.pos=m+1,Error("invalid tag encoding")},n.prototype.int32=function(){return this.uint32()|0},n.prototype.sint32=function(){var f=this.uint32();return f>>>1^-(f&1)|0};function c(){var g=new i(0,0),f=0;if(this.len-this.pos>4){for(;f<4;++f)if(g.lo=(g.lo|(this.buf[this.pos]&127)<<f*7)>>>0,this.buf[this.pos++]<128)return g;if(g.lo=(g.lo|(this.buf[this.pos]&127)<<28)>>>0,g.hi=(g.hi|(this.buf[this.pos]&127)>>4)>>>0,this.buf[this.pos++]<128)return g;f=0}else{for(;f<4;++f){if(this.pos>=this.len)throw r(this);if(g.lo=(g.lo|(this.buf[this.pos]&127)<<f*7)>>>0,this.buf[this.pos++]<128)return g}throw r(this)}if(this.len-this.pos>4){for(;f<5;++f)if(g.hi=(g.hi|(this.buf[this.pos]&127)<<f*7+3)>>>0,this.buf[this.pos++]<128)return g}else for(;f<5;++f){if(this.pos>=this.len)throw r(this);if(g.hi=(g.hi|(this.buf[this.pos]&127)<<f*7+3)>>>0,this.buf[this.pos++]<128)return g}throw Error("invalid varint encoding")}n.prototype.bool=function(){for(var f=!1,m,b=0;b<10;++b){if(this.pos>=this.len)throw r(this);if(m=this.buf[this.pos++],m&127&&(f=!0),m<128)return f}throw Error("invalid varint encoding")};function d(g,f){return(g[f-4]|g[f-3]<<8|g[f-2]<<16|g[f-1]<<24)>>>0}n.prototype.fixed32=function(){if(this.pos+4>this.len)throw r(this,4);return d(this.buf,this.pos+=4)},n.prototype.sfixed32=function(){if(this.pos+4>this.len)throw r(this,4);return d(this.buf,this.pos+=4)|0};function l(){if(this.pos+8>this.len)throw r(this,8);return new i(d(this.buf,this.pos+=4),d(this.buf,this.pos+=4))}n.prototype.float=function(){if(this.pos+4>this.len)throw r(this,4);var f=e.float.readFloatLE(this.buf,this.pos);return this.pos+=4,f},n.prototype.double=function(){if(this.pos+8>this.len)throw r(this,4);var f=e.float.readDoubleLE(this.buf,this.pos);return this.pos+=8,f},n.prototype.uint32s=function(f){f===void 0&&(f=[]);for(var m=this.uint32()+this.pos;this.pos<m;)f.push(this.uint32());return f},n.prototype.int32s=function(f){f===void 0&&(f=[]);for(var m=this.uint32()+this.pos;this.pos<m;)f.push(this.int32());return f},n.prototype.sint32s=function(f){f===void 0&&(f=[]);for(var m=this.uint32()+this.pos;this.pos<m;)f.push(this.sint32());return f},n.prototype.bools=function(f){f===void 0&&(f=[]);for(var m=this.uint32()+this.pos;this.pos<m;)f.push(this.bool());return f};var u=8,p=128;function h(g,f,m){var b=g.view;if(b||f<m)return b;var v=g.buf;return g.view=new DataView(v.buffer,v.byteOffset,v.byteLength)}return n.prototype.fixed32s=function(f){f===void 0&&(f=[]);var m=this.uint32(),b=this.pos+m;if(b>this.len)throw r(this,m);var v=m>>>2,y=f.length,w=this.pos;f.length=y+v;var C=h(this,v,p);if(C)for(var O=0;O<v;++O,w+=4)f[y++]=C.getUint32(w,!0);else for(var M=this.buf,A=0;A<v;++A,w+=4)f[y++]=d(M,w+4);if(this.pos=w,w!==b)throw r(this,4);return f},n.prototype.sfixed32s=function(f){f===void 0&&(f=[]);var m=this.uint32(),b=this.pos+m;if(b>this.len)throw r(this,m);var v=m>>>2,y=f.length,w=this.pos;f.length=y+v;var C=h(this,v,p);if(C)for(var O=0;O<v;++O,w+=4)f[y++]=C.getInt32(w,!0);else for(var M=this.buf,A=0;A<v;++A,w+=4)f[y++]=d(M,w+4)|0;if(this.pos=w,w!==b)throw r(this,4);return f},n.prototype.floats=function(f){f===void 0&&(f=[]);var m=this.uint32(),b=this.pos+m;if(b>this.len)throw r(this,m);var v=m>>>2,y=f.length,w=this.pos;f.length=y+v;var C=h(this,v,u);if(C)for(var O=0;O<v;++O,w+=4)f[y++]=C.getFloat32(w,!0);else for(var M=this.buf,A=0;A<v;++A,w+=4)f[y++]=e.float.readFloatLE(M,w);if(this.pos=w,w!==b)throw r(this,4);return f},n.prototype.doubles=function(f){f===void 0&&(f=[]);var m=this.uint32(),b=this.pos+m;if(b>this.len)throw r(this,m);var v=m>>>3,y=f.length,w=this.pos;f.length=y+v;var C=h(this,v,u);if(C)for(var O=0;O<v;++O,w+=8)f[y++]=C.getFloat64(w,!0);else for(var M=this.buf,A=0;A<v;++A,w+=8)f[y++]=e.float.readDoubleLE(M,w);if(this.pos=w,w!==b)throw r(this,8);return f},n.prototype.uint64s=function(f){f===void 0&&(f=[]);for(var m=this.uint32()+this.pos;this.pos<m;)f.push(this.uint64());return f},n.prototype.int64s=function(f){f===void 0&&(f=[]);for(var m=this.uint32()+this.pos;this.pos<m;)f.push(this.int64());return f},n.prototype.sint64s=function(f){f===void 0&&(f=[]);for(var m=this.uint32()+this.pos;this.pos<m;)f.push(this.sint64());return f},n.prototype.fixed64s=function(f){f===void 0&&(f=[]);var m=this.uint32(),b=this.pos+m,v=f.length;if(b>this.len)throw r(this,m);var y=m>>>3;f.length=v+y;for(var w=0;w<y;++w)f[v++]=this.fixed64();if(this.pos!==b)throw r(this,8);return f},n.prototype.sfixed64s=function(f){f===void 0&&(f=[]);var m=this.uint32(),b=this.pos+m,v=f.length;if(b>this.len)throw r(this,m);var y=m>>>3;f.length=v+y;for(var w=0;w<y;++w)f[v++]=this.sfixed64();if(this.pos!==b)throw r(this,8);return f},n.prototype.bytes=function(){var f=this.uint32(),m=this.pos,b=this.pos+f;if(b>this.len)throw r(this,f);return this.pos=b,this.raw(m,b)},n.prototype.string=function(){var f=this.uint32(),m=this.pos,b=this.pos+f;if(b>this.len)throw r(this,f);return this.pos=b,s.read(this.buf,m,b)},n.prototype.stringVerify=function(){var f=this.uint32(),m=this.pos,b=this.pos+f;if(b>this.len)throw r(this,f);return this.pos=b,s.readStrict(this.buf,m,b)},n.prototype.skip=function(f){if(typeof f=="number"){if(this.pos+f>this.len)throw r(this,f);this.pos+=f}else do if(this.pos>=this.len)throw r(this);while(this.buf[this.pos++]&128);return this},n.recursionLimit=e.recursionLimit,n.discardUnknown=!0,n.prototype.skipType=function(g,f,m){if(f===void 0&&(f=0),f>n.recursionLimit)throw Error("max depth exceeded");if(m===0)throw Error("illegal tag: field number 0");switch(g){case 0:this.skip();break;case 1:this.skip(8);break;case 2:this.skip(this.uint32());break;case 3:for(;;){var b=this.tag(),v=b>>>3;if(g=b&7,!v)throw Error("illegal tag: field number 0");if(g===4){if(m!==void 0&&v!==m)throw Error("invalid end group tag");break}this.skipType(g,f+1,v)}break;case 5:this.skip(4);break;default:throw Error("invalid wire type "+g+" at offset "+this.pos)}return this},n._configure=function(g){t=g,n.create=a(),t._configure();var f=e.Long?"toLong":"toNumber";e.merge(n.prototype,{int64:function(){return c.call(this)[f](!1)},uint64:function(){return c.call(this)[f](!0)},sint64:function(){return c.call(this).zzDecode()[f](!1)},fixed64:function(){return l.call(this)[f](!0)},sfixed64:function(){return l.call(this)[f](!1)}})},Ha}var Va,eh;function dw(){if(eh)return Va;eh=1,Va=i;var e=yc();i.prototype=Object.create(e.prototype,{constructor:{value:i,writable:!0,enumerable:!1,configurable:!0}});var t=Ri();function i(s){e.call(this,s)}return i._configure=function(){t.Buffer&&(i.prototype._slice=t.Buffer.prototype.slice)},i.prototype.raw=function(r,n){return this._slice.call(this.buf,r,n)},i.prototype.string=function(){var r=this.uint32(),n=this.pos,o=this.pos+r;if(o>this.len)throw RangeError("index out of range: "+this.pos+" + "+r+" > "+this.len);return this.pos=o,this.buf.utf8Slice?this.buf.utf8Slice(n,o):this.buf.toString("utf-8",n,o)},i._configure(),Va}var ja={},Ga,th;function uw(){if(th)return Ga;th=1,Ga=t;var e=Ri();t.prototype=Object.create(e.EventEmitter.prototype,{constructor:{value:t,writable:!0,enumerable:!1,configurable:!0}});function t(i,s,r){if(typeof i!="function")throw TypeError("rpcImpl must be a function");e.EventEmitter.call(this),this.rpcImpl=i,this.requestDelimited=!!s,this.responseDelimited=!!r}return t.prototype.rpcCall=function i(s,r,n,o,a){if(!o)throw TypeError("request must be specified");var c=this;if(!a)return e.asPromise(i,c,s,r,n,o);if(!c.rpcImpl){setTimeout(function(){a(Error("already ended"))},0);return}try{return c.rpcImpl(s,r[c.requestDelimited?"encodeDelimited":"encode"](o).finish(),function(l,u){if(l)return c.emit("error",l,s),a(l);if(u===null){c.end(!0);return}if(!(u instanceof n))try{u=n[c.responseDelimited?"decodeDelimited":"decode"](u)}catch(p){return c.emit("error",p,s),a(p)}return c.emit("data",u,s),a(null,u)})}catch(d){c.emit("error",d,s),setTimeout(function(){a(d)},0);return}},t.prototype.end=function(s){return this.rpcImpl&&(s||this.rpcImpl(null,null,null),this.rpcImpl=null,this.emit("end").off()),this},Ga}var ih;function Kp(){return ih||(ih=1,(function(e){var t=e;t.Service=uw()})(ja)),ja}var Wa,sh;function Xp(){return sh||(sh=1,Wa=Object.create(null)),Wa}var rh;function hw(){return rh||(rh=1,(function(e){e.build="minimal",e.Writer=vc(),e.BufferWriter=cw(),e.Reader=yc(),e.BufferReader=dw(),e.util=Ri(),e.rpc=Kp(),e.roots=Xp(),e.configure=t;function t(){e.Writer._configure(e.BufferWriter),e.Reader._configure(e.BufferReader)}t()})(Da)),Da}var Ya={},Ka={exports:{}},Xa={},nh;function Jp(){return nh||(nh=1,(function(e){var t=e;t.numberRe=/^(?![eE])[0-9]*(?:\.[0-9]*)?(?:[eE][+-]?[0-9]+)?$/,t.typeRefRe=/^(?:\.?[a-zA-Z_][a-zA-Z_0-9]*)(?:\.[a-zA-Z_][a-zA-Z_0-9]*)*$/,t.reservedRe=/^(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$/})(Xa)),Xa}var Ja,oh;function pw(){if(oh)return Ja;oh=1,Ja=i;var e=Jp(),t=e.reservedRe;function i(r,n){typeof r=="string"&&(n=r,r=void 0);var o=[];function a(d){if(typeof d!="string"){var l=c();if(i.verbose&&console.log("codegen: "+l),l="return "+l,d){for(var u=Object.keys(d),p=new Array(u.length+1),h=new Array(u.length),g=0;g<u.length;)p[g]=u[g],h[g]=d[u[g++]];return p[g]=l,Function.apply(null,p).apply(null,h)}return Function(l)()}for(var f=new Array(arguments.length-1),m=0;m<f.length;)f[m]=arguments[++m];if(m=0,d=d.replace(/%([%dfijs])/g,function(v,y){var w=f[m++];switch(y){case"d":case"f":return String(Number(w));case"i":return String(Math.floor(w));case"j":return JSON.stringify(w);case"s":return String(w)}return"%"}),m!==f.length)throw Error("parameter count mismatch");return o.push(d),a}function c(d){return"function "+s(d||n)+"("+(r&&r.join(",")||"")+`){
  `+o.join(`
  `)+`
}`}return Object.defineProperty(a,"toString",{value:c,writable:!0,enumerable:!0,configurable:!0}),a}i.verbose=!1;function s(r){return!r||(r=String(r).replace(/[^\w$]/g,""),!r)?"":(/^\d/.test(r)&&(r="_"+r),t.test(r)?r+"_":r)}return Ja}const fw={},mw=Object.freeze(Object.defineProperty({__proto__:null,default:fw},Symbol.toStringTag,{value:"Module"})),gw=nv(mw);var Za,ah;function Zp(){if(ah)return Za;ah=1;var e=null;try{e=gw,(!e||!e.readFile||!e.readFileSync)&&(e=null)}catch{}return Za=e,Za}var Qa,lh;function bw(){if(lh)return Qa;lh=1,Qa=i;var e=Yp(),t=Zp();function i(s,r,n){return typeof r=="function"?(n=r,r={}):r||(r={}),n?!r.xhr&&t&&t.readFile?t.readFile(s,function(a,c){return a&&typeof XMLHttpRequest<"u"?i.xhr(s,r,n):a?n(a):n(null,r.binary?c:c.toString("utf8"))}):i.xhr(s,r,n):e(i,this,s,r)}return i.xhr=function(r,n,o){var a=new XMLHttpRequest;a.onreadystatechange=function(){if(a.readyState===4){if(a.status!==0&&a.status!==200)return o(Error("status "+a.status));if(n.binary){var d=a.response;if(!d){d=[];for(var l=0;l<a.responseText.length;++l)d.push(a.responseText.charCodeAt(l)&255)}return o(null,typeof Uint8Array<"u"?new Uint8Array(d):d)}return o(null,a.responseText)}},n.binary&&("overrideMimeType"in a&&a.overrideMimeType("text/plain; charset=x-user-defined"),a.responseType="arraybuffer"),a.open("GET",r),a.send()},Qa}var el={},ch;function vw(){return ch||(ch=1,(function(e){var t=e,i=/^[a-zA-Z][a-zA-Z0-9+.-]+:\/\//;function s(a){if(typeof URL>"u"||!i.test(a))return null;try{return new URL(a).href}catch{return null}}function r(a,c){if(typeof URL>"u"||!i.test(a)||i.test(c))return null;try{return new URL(c,a).href}catch{return null}}var n=t.isAbsolute=function(c){return/^(?:\/|\w+:|\\\\\w+)/.test(c)},o=t.normalize=function(c){var d=s(c);if(d)return d;var l=c.substring(0,2),u="";l==="\\\\"&&(u=l,c=c.substring(2)),c=c.replace(/\\/g,"/").replace(/\/{2,}/g,"/");var p=c.split("/"),h=n(c),g="";h&&(g=p.shift()+"/");for(var f=0;f<p.length;)p[f]===".."?f>0&&p[f-1]!==".."?p.splice(--f,2):h?p.splice(f,1):++f:p[f]==="."?p.splice(f,1):++f;return u+g+p.join("/")};t.resolve=function(c,d,l){var u=r(c,d);return u||(l||(d=o(d)),n(d)?d:(l||(c=o(c)),(c=c.replace(/(?:\/|^)[^/]+$/,"")).length?o(c+"/"+d):d))}})(el)),el}var tl,dh;function Qr(){if(dh)return tl;dh=1,tl=c;var e=Ls();c.prototype=Object.create(e.prototype,{constructor:{value:c,writable:!0,enumerable:!1,configurable:!0}}),c.className="Namespace";var t=Ns(),i=bt(),s=lr(),r,n,o;c.fromJSON=function(u,p,h){if(h===void 0&&(h=0),h>i.recursionLimit)throw Error("max depth exceeded");return new c(u,p.options).addJSON(p.nested,h)};function a(l,u){if(l&&l.length){for(var p={},h=0;h<l.length;++h)p[l[h].name]=l[h].toJSON(u);return p}}c.arrayToJSON=a,c.isReservedId=function(u,p){if(u){for(var h=0;h<u.length;++h)if(typeof u[h]!="string"&&u[h][0]<=p&&u[h][1]>=p)return!0}return!1},c.isReservedName=function(u,p){if(u){for(var h=0;h<u.length;++h)if(u[h]===p)return!0}return!1};function c(l,u){e.call(this,l,u),this.nested=void 0,this._nestedArray=null,this._lookupCache=Object.create(null),this._needsRecursiveFeatureResolution=!0,this._needsRecursiveResolve=!0}function d(l){l._nestedArray=null,l._lookupCache=Object.create(null);for(var u=l;u=u.parent;)u._lookupCache=Object.create(null);return l}return Object.defineProperty(c.prototype,"nestedArray",{get:function(){return this._nestedArray||(this._nestedArray=i.toArray(this.nested))}}),c.prototype.toJSON=function(u){return i.toObject(["options",this.options,"nested",a(this.nestedArray,u)])},c.prototype.addJSON=function(u,p){if(p===void 0&&(p=0),p>i.recursionLimit)throw Error("max depth exceeded");var h=this;if(u)for(var g=Object.keys(u),f=0,m;f<g.length;++f)m=u[g[f]],h.add((m.fields!==void 0?r.fromJSON:m.values!==void 0?o.fromJSON:m.methods!==void 0?n.fromJSON:m.id!==void 0?t.fromJSON:c.fromJSON)(g[f],m,p+1));return this},c.prototype.get=function(u){return this.nested&&Object.prototype.hasOwnProperty.call(this.nested,u)?this.nested[u]:null},c.prototype.getEnum=function(u){if(this.nested&&Object.prototype.hasOwnProperty.call(this.nested,u)&&this.nested[u]instanceof o)return this.nested[u].values;throw Error("no such enum: "+u)},c.prototype.add=function(u){if(!(u instanceof t&&u.extend!==void 0||u instanceof r||u instanceof s||u instanceof o||u instanceof n||u instanceof c))throw TypeError("object must be a valid nested object");if(u.name==="__proto__")return this;if(!this.nested)this.nested={};else{var p=this.get(u.name);if(p)if(p instanceof c&&u instanceof c&&!(p instanceof r||p instanceof n)){for(var h=p.nestedArray,g=0;g<h.length;++g)u.add(h[g]);this.remove(p),this.nested||(this.nested={}),u.setOptions(p.options,!0)}else throw Error("duplicate name '"+u.name+"' in "+this)}this.nested[u.name]=u,this instanceof r||this instanceof n||this instanceof o||this instanceof t||u._edition||(u._edition=u._defaultEdition),this._needsRecursiveFeatureResolution=!0,this._needsRecursiveResolve=!0;for(var f=this;f=f.parent;)f._needsRecursiveFeatureResolution=!0,f._needsRecursiveResolve=!0;return u.onAdd(this),d(this)},c.prototype.remove=function(u){if(!(u instanceof e))throw TypeError("object must be a ReflectionObject");if(u.parent!==this)throw Error(u+" is not a member of "+this);if(!i.remove(this.nested,u,u.name))throw Error(u+" is not a member of "+this);return Object.keys(this.nested).length||(this.nested=void 0),u.onRemove(this),d(this)},c.prototype.define=function(u,p){if(i.isString(u))u=u.split(".");else if(!Array.isArray(u))throw TypeError("illegal path");if(u&&u.length&&u[0]==="")throw Error("path must be relative");if(u.length>i.recursionLimit)throw Error("max depth exceeded");for(var h=this;u.length>0;){var g=u.shift();if(h.nested&&h.nested[g]){if(h=h.nested[g],!(h instanceof c))throw Error("path conflicts with non-namespace objects")}else h.add(h=new c(g))}return p&&h.addJSON(p),h},c.prototype.resolveAll=function(){if(!this._needsRecursiveResolve)return this;this._needsRecursiveFeatureResolution&&this._resolveFeaturesRecursive(this._edition);var u=this.nestedArray,p=0;for(this.resolve();p<u.length;)u[p]instanceof c?u[p++].resolveAll():u[p++].resolve();return this._needsRecursiveResolve=!1,this},c.prototype._resolveFeaturesRecursive=function(u){return this._needsRecursiveFeatureResolution?(this._needsRecursiveFeatureResolution=!1,u=this._edition||u,e.prototype._resolveFeaturesRecursive.call(this,u),this.nestedArray.forEach(p=>{p._resolveFeaturesRecursive(u)}),this):this},c.prototype.lookup=function(u,p,h){if(typeof p=="boolean"?(h=p,p=void 0):p&&!Array.isArray(p)&&(p=[p]),i.isString(u)&&u.length){if(u===".")return this.root;u=u.split(".")}else if(!u.length)return this;var g=u.join(".");if(u[0]==="")return this.root.lookup(u.slice(1),p);var f=this._lookupImpl(u,g);if(f&&(!p||p.indexOf(f.constructor)>-1)||(f=this.root._fullyQualifiedObjects&&this.root._fullyQualifiedObjects["."+g],f&&(!p||p.indexOf(f.constructor)>-1)))return f;if(h)return null;for(var m=this;m.parent;){if(f=m.parent._lookupImpl(u,g),f&&(!p||p.indexOf(f.constructor)>-1))return f;m=m.parent}return null},c.prototype._lookupImpl=function(u,p){if(Object.prototype.hasOwnProperty.call(this._lookupCache,p))return this._lookupCache[p];var h=this.get(u[0]),g=null;if(h)u.length===1?g=h:h instanceof c&&(u=u.slice(1),g=h._lookupImpl(u,u.join(".")));else for(var f=0;f<this.nestedArray.length;++f)if(this._nestedArray[f]instanceof c&&(h=this._nestedArray[f]._lookupImpl(u,p))){g=h;break}return this._lookupCache[p]=g,g},c.prototype.lookupType=function(u){var p=this.lookup(u,[r]);if(!p)throw Error("no such type: "+u);return p},c.prototype.lookupEnum=function(u){var p=this.lookup(u,[o]);if(!p)throw Error("no such Enum '"+u+"' in "+this);return p},c.prototype.lookupTypeOrEnum=function(u){var p=this.lookup(u,[r,o]);if(!p)throw Error("no such Type or Enum '"+u+"' in "+this);return p},c.prototype.lookupService=function(u){var p=this.lookup(u,[n]);if(!p)throw Error("no such Service '"+u+"' in "+this);return p},c._configure=function(l,u,p){r=l,n=u,o=p},tl}var il,uh;function wc(){if(uh)return il;uh=1,il=s;var e=Ns();s.prototype=Object.create(e.prototype,{constructor:{value:s,writable:!0,enumerable:!1,configurable:!0}}),s.className="MapField";var t=Ds(),i=bt();function s(r,n,o,a,c,d){if(e.call(this,r,n,a,void 0,void 0,c,d),!i.isString(o))throw TypeError("keyType must be a string");this.keyType=o,this.resolvedKeyType=null,this.map=!0}return s.fromJSON=function(n,o){var a=new s(n,o.id,o.keyType,o.type,o.options,o.comment);return o.protoName&&(a.protoName=o.protoName),o.jsonName!==void 0?a.jsonName=o.jsonName:o.options&&o.options.json_name!==void 0&&(a.jsonName=o.options.json_name),a},s.prototype.toJSON=function(n){var o=n?!!n.keepComments:!1;return i.toObject(["keyType",this.keyType,"type",this.type,"id",this.id,"extend",this.extend,"protoName",this.protoName!==this.name?this.protoName:void 0,"jsonName",this.jsonName!==i.jsonName(this.protoName||this.name)?this.jsonName:void 0,"options",this.options,"comment",o?this.comment:void 0])},s.prototype.resolve=function(){if(this.resolved)return this;if(t.mapKey[this.keyType]===void 0)throw Error("invalid key type: "+this.keyType);return e.prototype.resolve.call(this)},s.d=function(n,o,a){return typeof a=="function"?a=i.decorateType(a).name:a&&typeof a=="object"&&(a=i.decorateEnum(a).name),function(d,l){i.decorateType(d.constructor).add(new s(l,n,o,a))}},il}var sl,hh;function _c(){if(hh)return sl;hh=1,sl=i;var e=Ls();i.prototype=Object.create(e.prototype,{constructor:{value:i,writable:!0,enumerable:!1,configurable:!0}}),i.className="Method";var t=bt();function i(s,r,n,o,a,c,d,l,u){if(t.isObject(a)?(d=a,a=c=void 0):t.isObject(c)&&(d=c,c=void 0),!(r===void 0||t.isString(r)))throw TypeError("type must be a string");if(!t.isString(n))throw TypeError("requestType must be a string");if(!t.isString(o))throw TypeError("responseType must be a string");e.call(this,s,d),this.type=r||"rpc",this.requestType=n,this.requestStream=a?!0:void 0,this.responseType=o,this.responseStream=c?!0:void 0,this.path="/"+this.name,this.resolvedRequestType=null,this.resolvedResponseType=null,this.comment=l,this.parsedOptions=u}return i.fromJSON=function(r,n){return new i(r,n.type,n.requestType,n.responseType,n.requestStream,n.responseStream,n.options,n.comment,n.parsedOptions)},i.prototype.toJSON=function(r){var n=r?!!r.keepComments:!1;return t.toObject(["type",this.type!=="rpc"&&this.type||void 0,"requestType",this.requestType,"requestStream",this.requestStream,"responseType",this.responseType,"responseStream",this.responseStream,"options",this.options,"comment",n?this.comment:void 0,"parsedOptions",this.parsedOptions])},i.prototype.resolve=function(){if(this.resolved)return this;if(this.parent){var r=this.parent.fullName;r.charAt(0)==="."&&(r=r.substring(1)),this.path="/"+r+"/"+this.name}else this.path="/"+this.name;return this.resolvedRequestType=this.parent.lookupType(this.requestType),this.resolvedResponseType=this.parent.lookupType(this.responseType),e.prototype.resolve.call(this)},sl}var rl,ph;function kc(){if(ph)return rl;ph=1,rl=r;var e=Qr();r.prototype=Object.create(e.prototype,{constructor:{value:r,writable:!0,enumerable:!1,configurable:!0}}),r.className="Service";var t=_c(),i=bt(),s=Kp();function r(o,a){e.call(this,o,a),this.methods={},this._methodsArray=null}r.fromJSON=function(a,c,d){if(d===void 0&&(d=0),d>i.recursionLimit)throw Error("max depth exceeded");var l=new r(a,c.options);if(c.methods)for(var u=Object.keys(c.methods),p=0;p<u.length;++p)l.add(t.fromJSON(u[p],c.methods[u[p]]));return c.nested&&l.addJSON(c.nested,d),c.edition&&(l._edition=c.edition),l.comment=c.comment,l._defaultEdition="proto3",l},r.prototype.toJSON=function(a){var c=e.prototype.toJSON.call(this,a),d=a?!!a.keepComments:!1;return i.toObject(["edition",this._editionToJSON(),"options",c&&c.options||void 0,"methods",e.arrayToJSON(this.methodsArray,a)||{},"nested",c&&c.nested||void 0,"comment",d?this.comment:void 0])},Object.defineProperty(r.prototype,"methodsArray",{get:function(){return this._methodsArray||(this._methodsArray=i.toArray(this.methods))}});function n(o){return o._methodsArray=null,o}return r.prototype.get=function(a){return Object.prototype.hasOwnProperty.call(this.methods,a)?this.methods[a]:e.prototype.get.call(this,a)},r.prototype.resolveAll=function(){if(!this._needsRecursiveResolve)return this;e.prototype.resolve.call(this);for(var a=this.methodsArray,c=0;c<a.length;++c)a[c].resolve();return this},r.prototype._resolveFeaturesRecursive=function(a){return this._needsRecursiveFeatureResolution?(a=this._edition||a,e.prototype._resolveFeaturesRecursive.call(this,a),this.methodsArray.forEach(c=>{c._resolveFeaturesRecursive(a)}),this):this},r.prototype.add=function(a){if(this.get(a.name))throw Error("duplicate name '"+a.name+"' in "+this);return a instanceof t?a.name==="__proto__"?this:(this.methods[a.name]=a,a.parent=this,n(this)):e.prototype.add.call(this,a)},r.prototype.remove=function(a){if(a instanceof t){if(this.methods[a.name]!==a)throw Error(a+" is not a member of "+this);return delete this.methods[a.name],a.parent=null,n(this)}return e.prototype.remove.call(this,a)},r.prototype.create=function(a,c,d){for(var l=new s.Service(a,c,d),u=0,p;u<this.methodsArray.length;++u){var h=i.lcFirst((p=this._methodsArray[u]).resolve().name).replace(/[^$\w_]/g,"");l[h]=(function(g,f,m){return function(v,y){return s.Service.prototype.rpcCall.call(this,g,f,m,v,y)}})(p,p.resolvedRequestType.ctor,p.resolvedResponseType.ctor)}return l},rl}var nl,fh;function Ec(){if(fh)return nl;fh=1,nl=t;var e=Ri();function t(i){if(i)for(var s=Object.keys(i),r=0;r<s.length;++r)i[s[r]]!=null&&s[r]!=="__proto__"&&(this[s[r]]=i[s[r]])}return t.create=function(s){return this.$type.create(s)},t.encode=function(s,r){return this.$type.encode(s,r)},t.encodeDelimited=function(s,r){return this.$type.encodeDelimited(s,r)},t.decode=function(s){return this.$type.decode(s)},t.decodeDelimited=function(s){return this.$type.decodeDelimited(s)},t.verify=function(s){return this.$type.verify(s)},t.fromObject=function(s){return this.$type.fromObject(s)},t.toObject=function(s,r){return this.$type.toObject(s,r)},t.prototype.toJSON=function(){return this.$type.toObject(this,e.toJSONOptions)},nl}var ol,mh;function Qp(){if(mh)return ol;mh=1,ol=o;var e=$i(),t=Ds(),i=bt();function s(a){return"missing required '"+a.name+"'"}function r(a){return a._features.utf8_validation==="VERIFY"?"stringVerify":"string"}function n(a,c){return a("if(!r.discardUnknown){")('util.makeProp(m,"$unknowns",false);')("(m.$unknowns||(m.$unknowns=[])).push(%s)",c)("}")}function o(a){for(var c=!1,d=!1,l=0;l<a.fieldsArray.length;++l){var u=a._fieldsArray[l];u.map&&(c=!0),(u.resolvedType instanceof e||!u.repeated&&!u.map&&!u.hasPresence)&&(d=!0)}var p=i.codegen(["r","l","z","q","g"])("if(!(r instanceof Reader))")("r=Reader.create(r)")("if(q===undefined)q=0")("if(q>Reader.recursionLimit)")('throw Error("max depth exceeded")')("var c=l===undefined?r.len:r.pos+l,m=g||new C"+(c?",k,v":d?",v":""))("while(r.pos<c){")("var s=r.pos")("var t=r.tag()")("if(t===z){")("z=undefined")("break")("}");for(a.fieldsArray.length&&p("var u=t&7")("switch(t>>>=3){"),l=0;l<a.fieldsArray.length;++l){var h=a._fieldsArray[l].resolve(),g=h.resolvedType instanceof e?"int32":h.type,f="m"+i.safeProp(h.name),m=h.resolvedType instanceof e&&h.resolvedType._features.enum_type==="CLOSED";if(h.map){p("case %i:{",h.id)("if(u!==2)")("break"),m||p("if(%s===util.emptyObject)",f)("%s={}",f),p("var c2=r.uint32()+r.pos"),t.defaults[h.keyType]!==void 0?p("k=%j",t.defaults[h.keyType]):p("k=null"),t.long[g]!==void 0?p("v=util.Long?util.Long.fromNumber(0,%j):0",g==="uint64"||g==="fixed64"):t.defaults[g]!==void 0?p("v=%j",t.defaults[g]):p("v=null"),p("while(r.pos<c2){")("var t2=r.tag()")("u=t2&7")("switch(t2>>>=3){")("case 1:")("if(u!==%i)",t.mapKey[h.keyType])("break")("k=r.%s()",h.keyType==="string"?r(h):h.keyType)("continue")("case 2:")("if(u!==%i)",t.basic[g]===void 0?2:t.basic[g])("break"),t.basic[g]===void 0?p("v=types[%i].decode(r,r.uint32(),undefined,q+1)",l):p("v=r.%s()",g==="string"?r(h):g),p("continue")("}")("r.skipType(u,q,t2)")("}"),m&&(p("if(types[%i].valuesById[v]===undefined){",l),n(p,"r.raw(s,r.pos)")("continue")("}")("if(%s===util.emptyObject)",f)("%s={}",f));var b=t.basic[g]===void 0?"v||new types["+l+"].ctor":"v";t.long[h.keyType]!==void 0?p('%s[typeof k==="object"?util.longToHash(k):k]=%s',f,b):(h.keyType==="string"&&p('if(k==="__proto__")')("util.makeProp(%s,k)",f),p("%s[k]=%s",f,b))}else h.repeated?(p("case %i:",h.id)("{"),t.packed[g]!==void 0&&(p("if(u===2){"),m?(p("var c2=r.uint32()+r.pos")("while(r.pos<c2){")("s=r.pos")("v=r.%s()",g)("if(types[%i].valuesById[v]!==undefined){",l)("if(!(%s&&%s.length))",f,f)("%s=[]",f)("%s.push(v)",f)("}else"),n(p,"util.rawField("+h.id+",0,r.raw(s,r.pos))")("}")):p("if(!(%s&&%s.length))",f,f)("%s=[]",f)("r.%ss(%s)",g,f),p("continue")("}")),p("if(u!==%i)",t.basic[g]===void 0?h.delimited?3:2:t.basic[g])("break"),m||p("if(!(%s&&%s.length))",f,f)("%s=[]",f),t.basic[g]===void 0?h.delimited?p("%s.push(types[%i].decode(r,undefined,%i,q+1))",f,l,h.id*8+4):p("%s.push(types[%i].decode(r,r.uint32(),undefined,q+1))",f,l):m?(p("v=r.%s()",g)("if(types[%i].valuesById[v]!==undefined){",l)("if(!(%s&&%s.length))",f,f)("%s=[]",f)("%s.push(v)",f)("}else"),n(p,"r.raw(s,r.pos)")):p("%s.push(r.%s())",f,g==="string"?r(h):g)):t.basic[g]===void 0?(p("case %i:{",h.id)("if(u!==%i)",h.delimited?3:2)("break"),h.delimited?p("%s=types[%i].decode(r,undefined,%i,q+1,%s)",f,l,h.id*8+4,f):p("%s=types[%i].decode(r,r.uint32(),undefined,q+1,%s)",f,l,f)):h.hasPresence?(p("case %i:{",h.id)("if(u!==%i)",t.basic[g])("break"),m?(p("v=r.%s()",g)("if(types[%i].valuesById[v]!==undefined){",l)("%s=v",f),h.partOf&&p("m%s=%j",i.safeProp(h.partOf.name),h.name),p("}else"),n(p,"r.raw(s,r.pos)")):p("%s=r.%s()",f,g==="string"?r(h):g)):(p("case %i:{",h.id)("if(u!==%i)",t.basic[g])("break"),m?(p("v=r.%s()",g)("if(types[%i].valuesById[v]!==undefined){",l)("if(v!==%j)",h.typeDefault)("%s=v",f)("else")("delete %s",f)("}else{"),n(p,"r.raw(s,r.pos)")("}")):(h.resolvedType instanceof e&&h.typeDefault!==0?p("if((v=r.%s())!==%j)",g,h.typeDefault):g==="string"?p("if((v=r.%s()).length)",r(h)):g==="bytes"?p("if((v=r.%s()).length)",g):t.long[g]!==void 0?p('if(typeof(v=r.%s())==="object"?v.low||v.high:v!==0)',g):p(g==="double"||g==="float"?"if(!Object.is(v=r.%s(),0))":"if(v=r.%s())",g),p("%s=v",f)("else")("delete %s",f)));h.partOf&&!m&&p("m%s=%j",i.safeProp(h.partOf.name),h.name),p("continue")("}")}for(l&&p("}"),p("r.skipType(%s,q,t)",l?"u":"t&7"),n(p,"r.raw(s,r.pos)")("}")("if(z!==undefined)")('throw Error("missing end group")'),l=0;l<a._fieldsArray.length;++l){var v=a._fieldsArray[l];v.required&&p("if(!Object.hasOwnProperty.call(m,%j))",v.name)("throw util.ProtocolError(%j,{instance:m})",s(v))}return p("return m")}return ol}var al,gh;function ef(){if(gh)return al;gh=1,al=n;var e=$i(),t=bt();function i(o,a){return o.name+": "+a+(o.repeated&&a!=="array"?"[]":o.map&&a!=="object"?"{k:"+o.keyType+"}":"")+" expected"}function s(o,a,c,d){var l=a.resolvedType;if(l)if(l instanceof e)if(l._features.enum_type==="CLOSED"){o("switch(%s){",d)("default:")("return%j",i(a,"enum value"));for(var u=Object.keys(l.values),p=0;p<u.length;++p)o("case %i:",l.values[u[p]]);o("break")("}")}else o('if(typeof %s!=="number"||(%s|0)!==%s)',d,d,d)("return%j",i(a,"enum value"));else o("{")("var e=types[%i].verify(%s,q+1);",c,d)("if(e)")("return%j+e",a.name+".")("}");else switch(a.type){case"int32":case"uint32":case"sint32":case"fixed32":case"sfixed32":o("if(!util.isInteger(%s))",d)("return%j",i(a,"integer"));break;case"int64":case"uint64":case"sint64":case"fixed64":case"sfixed64":o("if(!util.isInteger(%s)&&!(%s&&util.isInteger(%s.low)&&util.isInteger(%s.high)))",d,d,d,d)("return%j",i(a,"integer|Long"));break;case"float":case"double":o('if(typeof %s!=="number")',d)("return%j",i(a,"number"));break;case"bool":o('if(typeof %s!=="boolean")',d)("return%j",i(a,"boolean"));break;case"string":o("if(!util.isString(%s))",d)("return%j",i(a,"string"));break;case"bytes":o('if(!(%s&&typeof %s.length==="number"||util.isString(%s)))',d,d,d)("return%j",i(a,"buffer"));break}return o}function r(o,a,c){switch(a.keyType){case"int32":case"uint32":case"sint32":case"fixed32":case"sfixed32":o("if(!util.key32Re.test(%s))",c)("return%j",i(a,"integer key"));break;case"int64":case"uint64":case"sint64":case"fixed64":case"sfixed64":o("if(!util.key64Re.test(%s))",c)("return%j",i(a,"integer|Long key"));break;case"bool":o("if(!util.key2Re.test(%s))",c)("return%j",i(a,"boolean key"));break}return o}function n(o){var a=t.codegen(["m","q"])('if(typeof m!=="object"||m===null)')("return%j","object expected")("if(q===undefined)q=0")("if(q>util.recursionLimit)")("return%j","max depth exceeded"),c=o.oneofsArray,d={};c.length&&a("var p={}");for(var l=0;l<o.fieldsArray.length;++l){var u=o._fieldsArray[l].resolve(),p="m"+t.safeProp(u.name);if(u.optional&&a("if(%s!=null&&Object.hasOwnProperty.call(m,%j)){",p,u.name),u.map)a("if(!util.isObject(%s))",p)("return%j",i(u,"object"))("var k=Object.keys(%s)",p)("for(var i=0;i<k.length;++i){"),r(a,u,"k[i]"),s(a,u,l,p+"[k[i]]")("}");else if(u.repeated)a("if(!Array.isArray(%s))",p)("return%j",i(u,"array"))("for(var i=0;i<%s.length;++i){",p),s(a,u,l,p+"[i]")("}");else{if(u.partOf){var h=t.safeProp(u.partOf.name);d[u.partOf.name]===1&&a("if(p%s===1)",h)("return%j",u.partOf.name+": multiple values"),d[u.partOf.name]=1,a("p%s=1",h)}s(a,u,l,p)}u.optional&&a("}")}return a("return null")}return al}var ll={},bh;function tf(){return bh||(bh=1,(function(e){var t=e,i=$i(),s=Ds(),r=bt();function n(a,c,d,l,u){if(c.resolvedType)if(c.resolvedType instanceof i){var p=u?"m"+u+"[m"+u+".length]":"m"+l;a("switch(d%s){",l);for(var h=c.resolvedType.values,g=Object.keys(h),f=0;f<g.length;++f)a("case%j:",g[f])("case %i:",h[g[f]])("%s=%j",p,h[g[f]])("break");a("default:"),c.resolvedType._features.enum_type!=="CLOSED"&&a('if(typeof d%s==="number"&&(d%s|0)===d%s)',l,l,l)("%s=d%s",p,l),a("}")}else a("if(!util.isObject(d%s))",l)("throw TypeError(%j)",c.fullName+": object expected")("m%s=types[%i].fromObject(d%s,q+1)",l,d,l);else{var m=!1;switch(c.type){case"double":case"float":a("m%s=Number(d%s)",l,l);break;case"uint32":case"fixed32":a("m%s=d%s>>>0",l,l);break;case"int32":case"sint32":case"sfixed32":a("m%s=d%s|0",l,l);break;case"uint64":case"fixed64":m=!0;case"int64":case"sint64":case"sfixed64":a("if(util.Long)")("m%s=util.Long.fromValue(d%s,%j)",l,l,m)('else if(typeof d%s==="string")',l)("m%s=parseInt(d%s,10)",l,l)('else if(typeof d%s==="number")',l)("m%s=d%s",l,l)('else if(typeof d%s==="object")',l)("m%s=new util.LongBits(d%s.low>>>0,d%s.high>>>0).toNumber(%s)",l,l,l,m?"true":"");break;case"bytes":a('if(typeof d%s==="string")',l)("util.base64.decode(d%s,m%s=util.newBuffer(util.base64.length(d%s)),0)",l,l,l)("else if(d%s.length>=0)",l)("m%s=d%s",l,l);break;case"string":a("m%s=String(d%s)",l,l);break;case"bool":a("m%s=Boolean(d%s)",l,l);break}}return a}t.fromObject=function(c){var d=c.fieldsArray,l=r.codegen(["d","q"])("if(d instanceof C)")("return d")("if(!util.isObject(d))")("throw TypeError(%j)",c.fullName+": object expected")("if(q===undefined)q=0")("if(q>util.recursionLimit)")('throw Error("max depth exceeded")');if(!d.length)return l("return new C");l("var m=new C");for(var u=0;u<d.length;++u){var p=d[u].resolve(),h=r.safeProp(p.name),g=!p.hasPresence&&!p.repeated&&!p.map&&(p.resolvedType instanceof i||s.basic[p.type]!==void 0);p.map?(l("if(d%s){",h)("if(!util.isObject(d%s))",h)("throw TypeError(%j)",p.fullName+": object expected")("m%s={}",h)("for(var ks=Object.keys(d%s),i=0;i<ks.length;++i){",h),l('if(ks[i]==="__proto__")')("util.makeProp(m%s,ks[i])",h),n(l,p,u,h+"[ks[i]]")("}")("}")):p.repeated?(l("if(d%s){",h)("if(!Array.isArray(d%s))",h)("throw TypeError(%j)",p.fullName+": array expected"),p.resolvedType instanceof i?l("m%s=[]",h):l("m%s=Array(d%s.length)",h,h),l("for(var i=0;i<d%s.length;++i){",h),n(l,p,u,h+"[i]",p.resolvedType instanceof i?h:void 0)("}")("}")):(p.resolvedType instanceof i||l("if(d%s!=null){",h),g&&(p.resolvedType instanceof i?l('if(d%s!==%j&&(typeof d%s!=="string"||types[%i].values[d%s]!==%j)){',h,p.typeDefault,h,u,h,p.typeDefault):p.type==="string"?l('if(typeof d%s!=="string"||d%s.length){',h,h):p.type==="bytes"?l("if(d%s.length){",h):p.type==="bool"?l("if(d%s){",h):p.type==="double"||p.type==="float"?l("if(!Object.is(Number(d%s),0)){",h):s.long[p.type]!==void 0?l('if(typeof d%s==="object"?d%s.low||d%s.high:Number(d%s)!==0){',h,h,h,h):l("if(Number(d%s)!==0){",h)),n(l,p,u,h),g&&l("}"),p.resolvedType instanceof i||l("}"))}return l("return m")};function o(a,c,d,l,u){if(u||(u=l),c.resolvedType)c.resolvedType instanceof i?a("d%s=o.enums===String?(types[%i].values[m%s]===undefined?m%s:types[%i].values[m%s]):m%s",l,d,u,u,d,u,u):a("d%s=types[%i].toObject(m%s,o,q+1)",l,d,u);else{var p=!1;switch(c.type){case"double":case"float":a("d%s=o.json&&!isFinite(m%s)?String(m%s):m%s",l,u,u,u);break;case"uint64":case"fixed64":p=!0;case"int64":case"sint64":case"sfixed64":a('if(typeof BigInt!=="undefined"&&o.longs===BigInt)')('d%s=typeof m%s==="number"?BigInt(m%s):util.Long.fromBits(m%s.low>>>0,m%s.high>>>0,%j).toBigInt()',l,u,u,u,u,p)('else if(typeof m%s==="number")',u)("d%s=o.longs===String?String(m%s):m%s",l,u,u)("else")("d%s=o.longs===String?util.Long.prototype.toString.call(m%s):o.longs===Number?new util.LongBits(m%s.low>>>0,m%s.high>>>0).toNumber(%s):m%s",l,u,u,u,p?"true":"",u);break;case"bytes":a("d%s=o.bytes===String?util.base64.encode(m%s,0,m%s.length):o.bytes===Array?Array.prototype.slice.call(m%s):m%s",l,u,u,u,u);break;default:a("d%s=m%s",l,u);break}}return a}t.toObject=function(c){var d=c.fieldsArray.slice().sort(r.compareFieldsById);if(!d.length)return r.codegen()("return {}");for(var l=r.codegen(["m","o","q"])("if(!o)")("o={}")("if(q===undefined)q=0")("if(q>util.recursionLimit)")('throw Error("max depth exceeded")')("var d={}"),u=[],p=[],h=[],g=0;g<d.length;++g)d[g].partOf||(d[g].resolve().repeated?u:d[g].map?p:h).push(d[g]);if(u.length){for(l("if(o.arrays||o.defaults){"),g=0;g<u.length;++g)l("d%s=[]",r.safeProp(u[g].name));l("}")}if(p.length){for(l("if(o.objects||o.defaults){"),g=0;g<p.length;++g)l("d%s={}",r.safeProp(p[g].name));l("}")}if(h.length){for(l("if(o.defaults){"),g=0;g<h.length;++g){var f=h[g],m=r.safeProp(f.name);if(f.resolvedType instanceof i)l("d%s=o.enums===String?%j:%j",m,f.resolvedType.valuesById[f.typeDefault],f.typeDefault);else if(f.long)l("if(util.Long){")("var n=new util.Long(%i,%i,%j)",f.typeDefault.low,f.typeDefault.high,f.typeDefault.unsigned)('d%s=o.longs===String?n.toString():o.longs===Number?n.toNumber():typeof BigInt!=="undefined"&&o.longs===BigInt?n.toBigInt():n',m)("}else")('d%s=o.longs===String?%j:typeof BigInt!=="undefined"&&o.longs===BigInt?BigInt(%j):%i',m,f.typeDefault.toString(),f.typeDefault.toString(),f.typeDefault.toNumber());else if(f.bytes){var b=Array.prototype.slice.call(f.typeDefault);l("if(o.bytes===String)d%s=%j",m,String.fromCharCode.apply(String,f.typeDefault))("else{")("d%s=%j",m,b)("if(o.bytes!==Array)d%s=util.newBuffer(d%s)",m,m)("}")}else l("d%s=%j",m,f.typeDefault)}l("}")}var v=!1;for(g=0;g<d.length;++g){var f=d[g],y=c._fieldsArray.indexOf(f),m=r.safeProp(f.name);if(f.map){v||(v=!0,l("var ks2")),l("if(m%s&&(ks2=Object.keys(m%s)).length){",m,m)("d%s={}",m);var w=s.long[f.keyType]!==void 0,C=m+"[ks2[j]]";l("for(var j=0;j<ks2.length;++j){"),w&&l("var k2=util.longFromKey(ks2[j],%j).toString()",f.keyType==="uint64"||f.keyType==="fixed64"),l('if(ks2[j]==="__proto__")')("util.makeProp(d%s,ks2[j])",m),o(l,f,y,w?m+"[k2]":C,C)("}")}else f.repeated?(l("if(m%s&&m%s.length){",m,m)("d%s=Array(m%s.length)",m,m)("for(var j=0;j<m%s.length;++j){",m),o(l,f,y,m+"[j]")("}")):(l("if(m%s!=null&&Object.hasOwnProperty.call(m,%j)){",m,f.name),o(l,f,y,m),f.partOf&&!f.partOf.isProto3Optional&&l("if(o.oneofs)")("d%s=%j",r.safeProp(f.partOf.name),f.name));l("}")}return l("return d")}})(ll)),ll}var cl={},vh;function sf(){return vh||(vh=1,(function(e){var t=e,i=Ec(),s=Ri();t[".google.protobuf.Any"]={fromObject:function(r,n){if(r&&r["@type"]){var o=r["@type"].substring(r["@type"].lastIndexOf("/")+1),a=this.lookup(o,[this.constructor]);if(a){var c=r["@type"].charAt(0)==="."?r["@type"].slice(1):r["@type"];return c.indexOf("/")===-1&&(c="/"+c),this.create({type_url:c,value:a.encode(a.fromObject(r,n===void 0?1:n+1)).finish()})}}return this.fromObject(r,n)},toObject:function(r,n,o){if(o===void 0&&(o=0),o>s.recursionLimit)throw Error("max depth exceeded");var a="type.googleapis.com/",c="",d="";if(n&&n.json&&r.type_url&&r.value){d=r.type_url.substring(r.type_url.lastIndexOf("/")+1),c=r.type_url.substring(0,r.type_url.lastIndexOf("/")+1);var l=this.lookup(d,[this.constructor]);l&&(r=l.decode(r.value,void 0,void 0,o+1))}if(!(r instanceof this.ctor)&&r instanceof i){var u=r.$type.toObject(r,n,o+1),p=r.$type.fullName[0]==="."?r.$type.fullName.slice(1):r.$type.fullName;return c===""&&(c=a),d=c+p,u["@type"]=d,u}return this.toObject(r,n,o)}}})(cl)),cl}var dl,yh;function xc(){if(yh)return dl;yh=1,dl=f;var e=Qr();f.prototype=Object.create(e.prototype,{constructor:{value:f,writable:!0,enumerable:!1,configurable:!0}}),f.className="Type";var t=$i(),i=lr(),s=Ns(),r=wc(),n=kc(),o=Ec(),a=yc(),c=vc(),d=bt(),l=rf(),u=Qp(),p=ef(),h=tf(),g=sf();function f(b,v){b=b.replace(/\W/g,""),e.call(this,b,v),this.fields={},this.oneofs=void 0,this.extensions=void 0,this.reserved=void 0,this.group=void 0,this._fieldsById=null,this._fieldsArray=null,this._oneofsArray=null,this._ctor=null,this._fieldsByJsonName=null}Object.defineProperties(f.prototype,{fieldsById:{get:function(){if(this._fieldsById)return this._fieldsById;this._fieldsById={};for(var b=Object.keys(this.fields),v=0;v<b.length;++v){var y=this.fields[b[v]],w=y.id;if(this._fieldsById[w])throw Error("duplicate id "+w+" in "+this);this._fieldsById[w]=y}return this._fieldsById}},fieldsArray:{get:function(){return this._fieldsArray||(this._fieldsArray=d.toArray(this.fields))}},oneofsArray:{get:function(){return this._oneofsArray||(this._oneofsArray=d.toArray(this.oneofs))}},ctor:{get:function(){return this._ctor||(this.ctor=f.generateConstructor(this)())},set:function(b){var v=b.prototype;v instanceof o||(b.prototype=new o,Object.defineProperty(b.prototype,"constructor",{value:b,writable:!0,enumerable:!1,configurable:!0}),d.merge(b.prototype,v)),b.$type=b.prototype.$type=this,d.merge(b,o,!0),this._ctor=b,delete this.decode,delete this.fromObject;for(var y=0,w;y<this.fieldsArray.length;++y)w=this._fieldsArray[y].resolve(),b.prototype[w.name]=w.defaultValue;var C={};for(y=0;y<this.oneofsArray.length;++y)C[this._oneofsArray[y].resolve().name]={get:d.oneOfGetter(this._oneofsArray[y].oneof),set:d.oneOfSetter(this._oneofsArray[y].oneof)};y&&Object.defineProperties(b.prototype,C)}}}),f.generateConstructor=function(v){for(var y=d.codegen(["p"]),w=0,C;w<v.fieldsArray.length;++w)(C=v._fieldsArray[w]).map?y("this%s={}",d.safeProp(C.name)):C.repeated&&y("this%s=[]",d.safeProp(C.name));return y('if(p)for(var ks=Object.keys(p),i=0;i<ks.length;++i)if(p[ks[i]]!=null&&ks[i]!=="__proto__")')("this[ks[i]]=p[ks[i]]")};function m(b){return b._fieldsById=b._fieldsArray=b._oneofsArray=b._fieldsByJsonName=null,delete b.encode,delete b.decode,delete b.verify,b}return f.fromJSON=function(v,y,w){if(w===void 0&&(w=0),w>d.nestingLimit)throw Error("max depth exceeded");var C=new f(v,y.options);C.extensions=y.extensions,C.reserved=y.reserved;for(var O=Object.keys(y.fields),M=0;M<O.length;++M)C.add((typeof y.fields[O[M]].keyType<"u"?r.fromJSON:s.fromJSON)(O[M],y.fields[O[M]]));if(y.oneofs)for(O=Object.keys(y.oneofs),M=0;M<O.length;++M)C.add(i.fromJSON(O[M],y.oneofs[O[M]]));if(y.nested)for(O=Object.keys(y.nested),M=0;M<O.length;++M){var A=y.nested[O[M]];C.add((A.id!==void 0?s.fromJSON:A.fields!==void 0?f.fromJSON:A.values!==void 0?t.fromJSON:A.methods!==void 0?n.fromJSON:e.fromJSON)(O[M],A,w+1))}return y.extensions&&y.extensions.length&&(C.extensions=y.extensions),y.reserved&&y.reserved.length&&(C.reserved=y.reserved),y.group&&(C.group=!0),y.comment&&(C.comment=y.comment),y.edition&&(C._edition=y.edition),C._defaultEdition="proto3",C},f.prototype.toJSON=function(v){var y=e.prototype.toJSON.call(this,v),w=v?!!v.keepComments:!1;return d.toObject(["edition",this._editionToJSON(),"options",y&&y.options||void 0,"oneofs",e.arrayToJSON(this.oneofsArray,v),"fields",e.arrayToJSON(this.fieldsArray.filter(function(C){return!C.declaringField}),v)||{},"extensions",this.extensions&&this.extensions.length?this.extensions:void 0,"reserved",this.reserved&&this.reserved.length?this.reserved:void 0,"group",this.group||void 0,"nested",y&&y.nested||void 0,"comment",w?this.comment:void 0])},f.prototype.resolveAll=function(){if(!this._needsRecursiveResolve)return this;e.prototype.resolveAll.call(this);var v=this.oneofsArray;for(w=0;w<v.length;)v[w++].resolve();for(var y=this.fieldsArray,w=0;w<y.length;)y[w++].resolve();return this},f.prototype._resolveFeaturesRecursive=function(v){return this._needsRecursiveFeatureResolution?(v=this._edition||v,e.prototype._resolveFeaturesRecursive.call(this,v),this.oneofsArray.forEach(y=>{y._resolveFeatures(v)}),this.fieldsArray.forEach(y=>{y._resolveFeatures(v)}),this):this},f.prototype.get=function(v){return Object.prototype.hasOwnProperty.call(this.fields,v)?this.fields[v]:this.oneofs&&Object.prototype.hasOwnProperty.call(this.oneofs,v)?this.oneofs[v]:this.nested&&Object.prototype.hasOwnProperty.call(this.nested,v)?this.nested[v]:null},f.prototype.add=function(v){if(this.get(v.name))throw Error("duplicate name '"+v.name+"' in "+this);if(v instanceof s&&v.extend===void 0){if(this._fieldsById?this._fieldsById[v.id]:this.fieldsById[v.id])throw Error("duplicate id "+v.id+" in "+this);if(this.isReservedId(v.id))throw Error("id "+v.id+" is reserved in "+this);if(this.isReservedName(v.name)||v.name.charAt(0)==="$")throw Error("name '"+v.name+"' is reserved in "+this);return v.name==="__proto__"?this:(v.parent&&v.parent.remove(v),this.fields[v.name]=v,v.message=this,v.onAdd(this),m(this))}if(v instanceof i){if(v.name.charAt(0)==="$")throw Error("name '"+v.name+"' is reserved in "+this);return v.name==="__proto__"?this:(this.oneofs||(this.oneofs={}),this.oneofs[v.name]=v,v.onAdd(this),m(this))}return e.prototype.add.call(this,v)},f.prototype.remove=function(v){if(v instanceof s&&v.extend===void 0){if(!d.remove(this.fields,v,v.name))throw Error(v+" is not a member of "+this);return v.parent=null,v.onRemove(this),m(this)}if(v instanceof i){if(!d.remove(this.oneofs,v,v.name))throw Error(v+" is not a member of "+this);return v.parent=null,v.onRemove(this),m(this)}return e.prototype.remove.call(this,v)},f.prototype.isReservedId=function(v){return e.isReservedId(this.reserved,v)},f.prototype.isReservedName=function(v){return e.isReservedName(this.reserved,v)},f.prototype.create=function(v){return new this.ctor(v)},f.prototype.setup=function(){var v=this.root;if(v&&v._needsRecursiveFeatureResolution){var y=v._edition||this._edition;y&&v._resolveFeaturesRecursive(y)}for(var w=this.fullName,C=[],O=0;O<this.fieldsArray.length;++O)C.push(this._fieldsArray[O].resolve().resolvedType);this.encode=l(this)({Writer:c,types:C,util:d}),this.decode=u(this)({Reader:a,types:C,util:d,C:this.ctor}),this.verify=p(this)({types:C,util:d}),this.fromObject=h.fromObject(this)({types:C,util:d,C:this.ctor}),this.toObject=h.toObject(this)({types:C,util:d});var M=g[w];if(M){var A=Object.create(this);A._ctor=this.ctor,A.fromObject=this.fromObject,this.fromObject=M.fromObject.bind(A),A.toObject=this.toObject,this.toObject=M.toObject.bind(A)}return this},f.prototype.encode=function(v,y){return this.setup().encode.apply(this,arguments)},f.prototype.encodeDelimited=function(v,y){return this.encode(v,(y||c.create()).fork()).ldelim()},f.prototype.decode=function(v,y){return this.setup().decode.apply(this,arguments)},f.prototype.decodeDelimited=function(v){return v instanceof a||(v=a.create(v)),this.decode(v,v.uint32())},f.prototype.verify=function(v){return this.setup().verify.apply(this,arguments)},f.prototype.fromObject=function(v){return this.setup().fromObject.apply(this,arguments)},f.prototype.toObject=function(v,y){return this.setup().toObject.apply(this,arguments)},f.prototype.getTypeUrl=function(v){v===void 0&&(v="type.googleapis.com");var y=this.fullName;return v+"/"+(y.charAt(0)==="."?y.substring(1):y)},f.d=function(v){return function(w){d.decorateType(w,v)}},dl}var ul,wh;function Tc(){if(wh)return ul;wh=1,ul=c;var e=Qr();c.prototype=Object.create(e.prototype,{constructor:{value:c,writable:!0,enumerable:!1,configurable:!0}}),c.className="Root";var t=Ns(),i=$i(),s=lr(),r=bt(),n,o,a;function c(p){e.call(this,"",p),this.deferred=[],this.files=[],this._edition="proto2",this._fullyQualifiedObjects={}}c.fromJSON=function(h,g,f){if(f===void 0&&(f=0),f>r.recursionLimit)throw Error("max depth exceeded");return g||(g=new c),h.options&&g.setOptions(h.options),g.addJSON(h.nested,f).resolveAll()},c.prototype.resolvePath=r.path.resolve,c.prototype.fetch=r.fetch;function d(){}c.prototype.load=function p(h,g,f){typeof g=="function"&&(f=g,g=void 0);var m=this;if(!f)return r.asPromise(p,m,h,g);var b=f===d;function v(R,D){if(f){if(b)throw R;D&&D.resolveAll();var F=f;f=null,F(R,D)}}function y(R){var D=R.lastIndexOf("google/protobuf/");if(D>-1){var F=R.substring(D);if(Object.prototype.hasOwnProperty.call(a,F))return F}return Object.prototype.hasOwnProperty.call(a,R)?R:null}function w(R,D,F){F===void 0&&(F=0);try{if(F>r.recursionLimit)throw Error("max depth exceeded");if(r.isString(D)&&D.charAt(0)==="{"&&(D=JSON.parse(D)),!r.isString(D))m.setOptions(D.options).addJSON(D.nested);else{o.filename=R;var P=o(D,m,g),S,I=0;if(P.imports)for(;I<P.imports.length;++I)(S=y(P.imports[I])||m.resolvePath(R,P.imports[I]))&&C(S,!1,F+1);if(P.weakImports)for(I=0;I<P.weakImports.length;++I)(S=y(P.weakImports[I])||m.resolvePath(R,P.weakImports[I]))&&C(S,!0,F+1)}}catch(_){v(_)}!b&&!O&&v(null,m)}function C(R,D,F){if(F===void 0&&(F=0),R=y(R)||R,!(m.files.indexOf(R)>-1)){if(m.files.push(R),Object.prototype.hasOwnProperty.call(a,R)){b?w(R,a[R],F):(++O,setTimeout(function(){--O,w(R,a[R],F)}));return}if(b){var P;try{P=r.fs.readFileSync(R).toString("utf8")}catch(S){D||v(S);return}w(R,P,F)}else++O,m.fetch(R,function(S,I){if(--O,!!f){if(S){D?O||v(null,m):v(S);return}w(R,I,F)}})}}var O=0;r.isString(h)&&(h=[h]);for(var M=0,A;M<h.length;++M)(A=m.resolvePath("",h[M]))&&C(A);return b?(m.resolveAll(),m):(O||v(null,m),m)},c.prototype.loadSync=function(h,g){if(!r.isNode)throw Error("not supported");return this.load(h,g,d)},c.prototype.resolveAll=function(){if(!this._needsRecursiveResolve)return this;if(this.deferred.length)throw Error("unresolvable extensions: "+this.deferred.map(function(h){return"'extend "+h.extend+"' in "+h.parent.fullName}).join(", "));return e.prototype.resolveAll.call(this)};var l=/^[A-Z]/;function u(p,h){var g=h.parent.lookup(h.extend);if(g){var f=new t(h.fullName,h.id,h.type,h.rule,void 0,h.options);return g.get(f.name)||(f.declaringField=h,h.extensionField=f,g.add(f)),!0}return!1}return c.prototype._handleAdd=function(h){if(h instanceof t)h.extend!==void 0&&!h.extensionField&&(u(this,h)||this.deferred.push(h));else if(h instanceof i)l.test(h.name)&&(h.parent[h.name]=h.values);else if(!(h instanceof s)){if(h instanceof n)for(var g=0;g<this.deferred.length;)u(this,this.deferred[g])?this.deferred.splice(g,1):++g;for(var f=0;f<h.nestedArray.length;++f)this._handleAdd(h._nestedArray[f]);l.test(h.name)&&(h.parent[h.name]=h)}(h instanceof n||h instanceof i||h instanceof t)&&(this._fullyQualifiedObjects[h.fullName]=h)},c.prototype._handleRemove=function(h){if(h instanceof t){if(h.extend!==void 0)if(h.extensionField)h.extensionField.parent.remove(h.extensionField),h.extensionField=null;else{var g=this.deferred.indexOf(h);g>-1&&this.deferred.splice(g,1)}}else if(h instanceof i)l.test(h.name)&&delete h.parent[h.name];else if(h instanceof e){for(var f=0;f<h.nestedArray.length;++f)this._handleRemove(h._nestedArray[f]);l.test(h.name)&&delete h.parent[h.name]}delete this._fullyQualifiedObjects[h.fullName]},c._configure=function(p,h,g){n=p,o=h,a=g},ul}var _h;function bt(){if(_h)return Ka.exports;_h=1;var e=Ka.exports=Ri(),t=Xp(),i,s;e.codegen=pw(),e.fetch=bw(),e.path=vw(),e.patterns=Jp();var r=e.patterns.reservedRe;e.fs=Zp(),e.toArray=function(c){if(c){for(var d=Object.keys(c),l=new Array(d.length),u=0;u<d.length;)l[u]=c[d[u++]];return l}return[]},e.toObject=function(c){for(var d={},l=0;l<c.length;){var u=c[l++],p=c[l++];p!==void 0&&(d[u]=p)}return d},e.remove=function(c,d,l){if(!c)return!1;if(l!==void 0&&Object.prototype.hasOwnProperty.call(c,l)&&c[l]===d)return delete c[l],!0;for(var u=Object.keys(c),p=0;p<u.length;++p)if(c[u[p]]===d)return delete c[u[p]],!0;return!1},e.isReserved=function(c){return r.test(c)},e.safeProp=function(c){return!/^[$\w_]+$/.test(c)||r.test(c)?"["+JSON.stringify(c)+"]":"."+c},e.ucFirst=function(c){return c.charAt(0).toUpperCase()+c.substring(1)};var n=/_([a-z])/g;e.camelCase=function(c){return c.substring(0,1)+c.substring(1).replace(n,function(d,l){return l.toUpperCase()})},e.jsonName=function(c){for(var d="",l=!1,u=0;u<c.length;++u){var p=c.charAt(u);p==="_"?l=!0:l?(d+=p.toUpperCase(),l=!1):d+=p}return d},e.compareFieldsById=function(c,d){return c.id-d.id},e.decorateType=function(c,d){if(c.$type)return d&&c.$type.name!==d&&(e.decorateRoot.remove(c.$type),c.$type.name=d,e.decorateRoot.add(c.$type)),c.$type;i||(i=xc());var l=new i(d||c.name);return e.decorateRoot.add(l),l.ctor=c,Object.defineProperty(c,"$type",{value:l,enumerable:!1}),Object.defineProperty(c.prototype,"$type",{value:l,enumerable:!1}),l};var o=0;return e.decorateEnum=function(c){if(c.$type)return c.$type;s||(s=$i());var d=new s("Enum"+o++,c);return e.decorateRoot.add(d),Object.defineProperty(c,"$type",{value:d,enumerable:!1}),d},e.setProperty=function(c,d,l,u){function p(h,g,f){var m=g.shift();if(e.isUnsafeProperty(m))return h;if(g.length>0)h[m]=p(h[m]||{},g,f);else{var b=h[m];if(b&&u)return h;b&&(f=[].concat(b).concat(f)),h[m]=f}return h}if(typeof c!="object")throw TypeError("dst must be an object");if(!d)throw TypeError("path must be specified");if(d=d.split("."),d.length>e.recursionLimit)throw Error("max depth exceeded");return p(c,d,l)},Object.defineProperty(e,"decorateRoot",{get:function(){return t.decorated||(t.decorated=new(Tc()))}}),Ka.exports}var kh;function Ds(){return kh||(kh=1,(function(e){var t=e,i=bt(),s=["double","float","int32","uint32","sint32","fixed32","sfixed32","int64","uint64","sint64","fixed64","sfixed64","bool","string","bytes"];function r(n,o){var a=0,c=Object.create(null);for(o|=0;a<n.length;)c[s[a+o]]=n[a++];return c}t.basic=r([1,5,0,0,0,5,5,0,0,0,1,1,0,2,2]),t.defaults=r([0,0,0,0,0,0,0,0,0,0,0,0,!1,"",i.emptyArray,null]),t.long=r([0,0,0,1,1],7),t.mapKey=r([0,0,0,5,5,0,0,0,1,1,0,2],2),t.packed=r([1,5,0,0,0,5,5,0,0,0,1,1,0])})(Ya)),Ya}var hl,Eh;function Ns(){if(Eh)return hl;Eh=1,hl=o;var e=Ls();o.prototype=Object.create(e.prototype,{constructor:{value:o,writable:!0,enumerable:!1,configurable:!0}}),o.className="Field";var t=$i(),i=Ds(),s=bt(),r,n=/^(?:required|optional|repeated)$/;o.fromJSON=function(c,d){var l=new o(c,d.id,d.type,d.rule,d.extend,d.options,d.comment);return d.edition&&(l._edition=d.edition),d.protoName&&(l.protoName=d.protoName),d.jsonName!==void 0?l.jsonName=d.jsonName:d.options&&d.options.json_name!==void 0&&(l.jsonName=d.options.json_name),l._defaultEdition="proto3",l};function o(a,c,d,l,u,p,h){if(s.isObject(l)?(h=u,p=l,l=u=void 0):s.isObject(u)&&(h=p,p=u,u=void 0),e.call(this,a,p),!s.isInteger(c)||c<0)throw TypeError("id must be a non-negative integer");if(!s.isString(d))throw TypeError("type must be a string");if(l!==void 0&&!n.test(l=l.toString().toLowerCase()))throw TypeError("rule must be a string rule");if(u!==void 0&&!s.isString(u))throw TypeError("extend must be a string");this.rule=l&&l!=="optional"?l:void 0,this.type=d,this.id=c,this.extend=u||void 0,this.repeated=l==="repeated",this.map=!1,this.message=null,this.partOf=null,this.typeDefault=null,this.defaultValue=null,this.long=s.Long?i.long[d]!==void 0:!1,this.bytes=d==="bytes",this.resolvedType=null,this.extensionField=null,this.declaringField=null,this.comment=h,this.protoName=void 0,this.jsonName=void 0}return Object.defineProperty(o.prototype,"required",{get:function(){return this._features.field_presence==="LEGACY_REQUIRED"}}),Object.defineProperty(o.prototype,"optional",{get:function(){return!this.required}}),Object.defineProperty(o.prototype,"delimited",{get:function(){return this.resolvedType instanceof r&&this._features.message_encoding==="DELIMITED"}}),Object.defineProperty(o.prototype,"packed",{get:function(){return this._features.repeated_field_encoding==="PACKED"}}),Object.defineProperty(o.prototype,"hasPresence",{get:function(){return this.repeated||this.map?!1:this.partOf||this.declaringField||this.extensionField||this._features.field_presence!=="IMPLICIT"}}),o.prototype.setOption=function(c,d,l){return e.prototype.setOption.call(this,c,d,l)},o.prototype.toJSON=function(c){var d=c?!!c.keepComments:!1;return s.toObject(["edition",this._editionToJSON(),"rule",this.rule!=="optional"&&this.rule||void 0,"type",this.type,"id",this.id,"extend",this.extend,"protoName",this.protoName!==this.name?this.protoName:void 0,"jsonName",this.jsonName!==s.jsonName(this.protoName||this.name)?this.jsonName:void 0,"options",this.options,"comment",d?this.comment:void 0])},o.prototype.resolve=function(){if(this.resolved)return this;if((this.typeDefault=i.defaults[this.type])===void 0?(this.resolvedType=(this.declaringField?this.declaringField.parent:this.parent).lookupTypeOrEnum(this.type),this.resolvedType instanceof r?this.typeDefault=null:this.typeDefault=this.resolvedType.values[Object.keys(this.resolvedType.values)[0]]):this.options&&this.options.proto3_optional&&(this.typeDefault=null),this.options&&this.options.default!=null&&(this.typeDefault=this.options.default,this.resolvedType instanceof t&&typeof this.typeDefault=="string"&&(this.typeDefault=this.resolvedType.values[this.typeDefault])),this.options&&(this.options.packed!==void 0&&this.resolvedType&&!(this.resolvedType instanceof t)&&delete this.options.packed,Object.keys(this.options).length||(this.options=void 0)),this.long)this.typeDefault=s.Long.fromNumber(this.typeDefault,this.type==="uint64"||this.type==="fixed64"),Object.freeze&&Object.freeze(this.typeDefault);else if(this.bytes&&typeof this.typeDefault=="string"){var c;s.base64.test(this.typeDefault)?s.base64.decode(this.typeDefault,c=s.newBuffer(s.base64.length(this.typeDefault)),0):s.utf8.write(this.typeDefault,c=s.newBuffer(s.utf8.length(this.typeDefault)),0),this.typeDefault=c}return this.map?this.defaultValue=s.emptyObject:this.repeated?this.defaultValue=s.emptyArray:this.defaultValue=this.typeDefault,this.parent instanceof r&&this.parent._ctor&&(this.parent._ctor.prototype[this.name]=this.defaultValue),this.protoName===void 0&&(this.protoName=this.name),this.jsonName===void 0&&(this.jsonName=s.jsonName(this.protoName)),e.prototype.resolve.call(this)},o.prototype._inferLegacyProtoFeatures=function(c){if(c!=="proto2"&&c!=="proto3")return{};var d={};if(this.rule==="required"&&(d.field_presence="LEGACY_REQUIRED"),this.parent&&i.defaults[this.type]===void 0){var l=this.parent.get(this.type.split(".").pop());l&&l instanceof r&&l.group&&(d.message_encoding="DELIMITED")}return this.getOption("packed")===!0?d.repeated_field_encoding="PACKED":this.getOption("packed")===!1&&(d.repeated_field_encoding="EXPANDED"),d},o.prototype._resolveFeatures=function(c){return e.prototype._resolveFeatures.call(this,this._edition||c)},o.d=function(c,d,l,u){return typeof d=="function"?d=s.decorateType(d).name:d&&typeof d=="object"&&(d=s.decorateEnum(d).name),function(h,g){s.decorateType(h.constructor).add(new o(g,c,d,l,{default:u}))}},o._configure=function(c){r=c},hl}var pl,xh;function lr(){if(xh)return pl;xh=1,pl=s;var e=Ls();s.prototype=Object.create(e.prototype,{constructor:{value:s,writable:!0,enumerable:!1,configurable:!0}}),s.className="OneOf";var t=Ns(),i=bt();function s(n,o,a,c){if(Array.isArray(o)||(a=o,o=void 0),e.call(this,n,a),!(o===void 0||Array.isArray(o)))throw TypeError("fieldNames must be an Array");this.oneof=o||[],this.fieldsArray=[],this.comment=c}s.fromJSON=function(o,a){return new s(o,a.oneof,a.options,a.comment)},s.prototype.toJSON=function(o){var a=o?!!o.keepComments:!1;return i.toObject(["options",this.options,"oneof",this.oneof,"comment",a?this.comment:void 0])};function r(n){if(n.parent)for(var o=0;o<n.fieldsArray.length;++o)n.fieldsArray[o].parent||n.parent.add(n.fieldsArray[o])}return s.prototype.add=function(o){if(!(o instanceof t))throw TypeError("field must be a Field");return o.parent&&o.parent!==this.parent&&o.parent.remove(o),this.oneof.push(o.name),this.fieldsArray.push(o),o.partOf=this,r(this),this},s.prototype.remove=function(o){if(!(o instanceof t))throw TypeError("field must be a Field");var a=this.fieldsArray.indexOf(o);if(a<0)throw Error(o+" is not a member of "+this);return this.fieldsArray.splice(a,1),a=this.oneof.indexOf(o.name),a>-1&&this.oneof.splice(a,1),o.partOf=null,this},s.prototype.onAdd=function(o){e.prototype.onAdd.call(this,o);for(var a=this,c=0;c<this.oneof.length;++c){var d=o.get(this.oneof[c]);d&&!d.partOf&&(d.partOf=a,a.fieldsArray.push(d))}r(this)},s.prototype.onRemove=function(o){for(var a=0,c;a<this.fieldsArray.length;++a)(c=this.fieldsArray[a]).parent&&c.parent.remove(c);e.prototype.onRemove.call(this,o)},Object.defineProperty(s.prototype,"isProto3Optional",{get:function(){if(this.fieldsArray==null||this.fieldsArray.length!==1)return!1;var n=this.fieldsArray[0];return n.options!=null&&n.options.proto3_optional===!0}}),s.d=function(){for(var o=new Array(arguments.length),a=0;a<arguments.length;)o[a]=arguments[a++];return function(d,l){i.decorateType(d.constructor).add(new s(l,o)),Object.defineProperty(d,l,{get:i.oneOfGetter(o),set:i.oneOfSetter(o)})}},pl}var fl,Th;function Ls(){if(Th)return fl;Th=1,fl=a,a.className="ReflectionObject";const e=lr();var t=bt(),i,s={enum_type:"OPEN",field_presence:"EXPLICIT",json_format:"ALLOW",message_encoding:"LENGTH_PREFIXED",repeated_field_encoding:"PACKED",utf8_validation:"VERIFY",enforce_naming_style:"STYLE2024",default_symbol_visibility:"EXPORT_TOP_LEVEL"},r={enum_type:"OPEN",field_presence:"EXPLICIT",json_format:"ALLOW",message_encoding:"LENGTH_PREFIXED",repeated_field_encoding:"PACKED",utf8_validation:"VERIFY",enforce_naming_style:"STYLE_LEGACY",default_symbol_visibility:"EXPORT_ALL"},n={enum_type:"CLOSED",field_presence:"EXPLICIT",json_format:"LEGACY_BEST_EFFORT",message_encoding:"LENGTH_PREFIXED",repeated_field_encoding:"EXPANDED",utf8_validation:"NONE",enforce_naming_style:"STYLE_LEGACY",default_symbol_visibility:"EXPORT_ALL"},o={enum_type:"OPEN",field_presence:"IMPLICIT",json_format:"ALLOW",message_encoding:"LENGTH_PREFIXED",repeated_field_encoding:"PACKED",utf8_validation:"VERIFY",enforce_naming_style:"STYLE_LEGACY",default_symbol_visibility:"EXPORT_ALL"};function a(c,d){if(!t.isString(c))throw TypeError("name must be a string");if(d&&!t.isObject(d))throw TypeError("options must be an object");this.options=d,this.parsedOptions=null,this.name=c,this._edition=null,this._defaultEdition="proto2",this._features={},this._featuresResolved=!1,this.parent=null,this.resolved=!1,this.comment=null,this.filename=null}return Object.defineProperties(a.prototype,{root:{get:function(){for(var c=this;c.parent!==null;)c=c.parent;return c}},fullName:{get:function(){for(var c=[this.name],d=this.parent;d;)c.unshift(d.name),d=d.parent;return c.join(".")}}}),a.prototype.toJSON=function(){throw Error()},a.prototype.onAdd=function(d){this.parent&&this.parent!==d&&this.parent.remove(this),this.parent=d,this.resolved=!1;var l=d.root;l instanceof i&&l._handleAdd(this)},a.prototype.onRemove=function(d){var l=d.root;l instanceof i&&l._handleRemove(this),this.parent=null,this.resolved=!1},a.prototype.resolve=function(){return this.resolved?this:(this.root instanceof i&&(this.resolved=!0),this)},a.prototype._resolveFeaturesRecursive=function(d){return this._resolveFeatures(this._edition||d)},a.prototype._resolveFeatures=function(d){if(!this._featuresResolved){var l={};if(!d)throw new Error("Unknown edition for "+this.fullName);var u=t.merge({},this.options&&this.options.features,this._inferLegacyProtoFeatures(d));if(this._edition){if(d==="proto2")l=Object.assign({},n);else if(d==="proto3")l=Object.assign({},o);else if(d==="2023")l=Object.assign({},r);else if(d==="2024")l=Object.assign({},s);else throw new Error("Unknown edition: "+d);this._features=t.merge(l,u)}else if(this.partOf instanceof e){var p=t.merge({},this.partOf._features);this._features=t.merge(p,u)}else if(!this.declaringField)if(this.parent){var h=t.merge({},this.parent._features);this._features=t.merge(h,u)}else throw new Error("Unable to find a parent for "+this.fullName);this.extensionField&&(this.extensionField._features=this._features),this._featuresResolved=!0}},a.prototype._inferLegacyProtoFeatures=function(){return{}},a.prototype.getOption=function(d){if(this.options&&Object.prototype.hasOwnProperty.call(this.options,d))return this.options[d]},a.prototype.setOption=function(d,l,u){if(d==="__proto__")return this;if(this.options||(this.options={}),/^features\./.test(d))t.setProperty(this.options,d,l,u);else{var p=this.getOption(d);(!u||p===void 0)&&(p!==l&&(this.resolved=!1),this.options[d]=l)}return this},a.prototype.setParsedOption=function(d,l,u){if(d==="__proto__")return this;this.parsedOptions||(this.parsedOptions=[]);var p=this.parsedOptions;if(u){var h=p.find(function(m){return Object.prototype.hasOwnProperty.call(m,d)});if(h){var g=h[d];t.setProperty(g,u,l)}else h={},h[d]=t.setProperty({},u,l),p.push(h)}else{var f={};f[d]=l,p.push(f)}return this},a.prototype.setOptions=function(d,l){if(d)for(var u=Object.keys(d),p=0;p<u.length;++p)this.setOption(u[p],d[u[p]],l);return this},Object.defineProperty(a.prototype,"toString",{value:function(){var d=this.constructor.className,l=this.fullName;return l.length?d+" "+l:d},writable:!0,enumerable:!1,configurable:!0}),a.prototype._editionToJSON=function(){if(!(!this._edition||this._edition==="proto3"))return this._edition},a._configure=function(c){i=c},fl}var ml,Ch;function $i(){if(Ch)return ml;Ch=1,ml=s;var e=Ls();s.prototype=Object.create(e.prototype,{constructor:{value:s,writable:!0,enumerable:!1,configurable:!0}}),s.className="Enum";var t=Qr(),i=bt();function s(r,n,o,a,c,d){if(e.call(this,r,o),n&&typeof n!="object")throw TypeError("values must be an object");if(this.valuesById=Object.create(null),this.values=Object.create(this.valuesById),this.comment=a,this.comments=c||{},this.valuesOptions=d,this._valuesFeatures={},this.reserved=void 0,n)for(var l=Object.keys(n),u=0;u<l.length;++u)l[u]!=="__proto__"&&typeof n[l[u]]=="number"&&(this.valuesById[this.values[l[u]]=n[l[u]]]=l[u])}return s.prototype._resolveFeatures=function(n){return n=this._edition||n,e.prototype._resolveFeatures.call(this,n),Object.keys(this.values).forEach(o=>{var a=i.merge({},this._features);this._valuesFeatures[o]=i.merge(a,this.valuesOptions&&this.valuesOptions[o]&&this.valuesOptions[o].features||{})}),this},s.fromJSON=function(n,o){var a=new s(n,o.values,o.options,o.comment,o.comments,o.valuesOptions);return a.reserved=o.reserved,o.edition&&(a._edition=o.edition),a._defaultEdition="proto3",a},s.prototype.toJSON=function(n){var o=n?!!n.keepComments:!1;return i.toObject(["edition",this._editionToJSON(),"options",this.options,"valuesOptions",this.valuesOptions,"values",this.values,"reserved",this.reserved&&this.reserved.length?this.reserved:void 0,"comment",o?this.comment:void 0,"comments",o?this.comments:void 0])},s.prototype.add=function(n,o,a,c){if(!i.isString(n))throw TypeError("name must be a string");if(!i.isInteger(o))throw TypeError("id must be an integer");if(n==="__proto__")return this;if(this.values[n]!==void 0)throw Error("duplicate name '"+n+"' in "+this);if(this.isReservedId(o))throw Error("id "+o+" is reserved in "+this);if(this.isReservedName(n))throw Error("name '"+n+"' is reserved in "+this);if(this.valuesById[o]!==void 0){if(!(this.options&&this.options.allow_alias))throw Error("duplicate id "+o+" in "+this);this.values[n]=o}else this.valuesById[this.values[n]=o]=n;return c&&(this.valuesOptions===void 0&&(this.valuesOptions={}),this.valuesOptions[n]=c||null),this.comments[n]=a||null,this},s.prototype.remove=function(n){if(!i.isString(n))throw TypeError("name must be a string");var o=this.values[n];if(o==null)throw Error("name '"+n+"' does not exist in "+this);return delete this.valuesById[o],delete this.values[n],delete this.comments[n],this.valuesOptions&&delete this.valuesOptions[n],this},s.prototype.isReservedId=function(n){return t.isReservedId(this.reserved,n)},s.prototype.isReservedName=function(n){return t.isReservedName(this.reserved,n)},ml}var gl,Sh;function rf(){if(Sh)return gl;Sh=1,gl=r;var e=$i(),t=Ds(),i=bt();function s(n,o,a,c){return o.delimited?n("types[%i].encode(%s,w.uint32(%i),q+1).uint32(%i)",a,c,(o.id<<3|3)>>>0,(o.id<<3|4)>>>0):n("types[%i].encode(%s,w.uint32(%i).fork(),q+1).ldelim()",a,c,(o.id<<3|2)>>>0)}function r(n){for(var o=i.codegen(["m","w","q"])("if(!w)")("w=Writer.create()")("if(q===undefined)q=0")("if(q>util.recursionLimit)")('throw Error("max depth exceeded")'),a,c,d=n.fieldsArray.slice().sort(i.compareFieldsById),a=0;a<d.length;++a){var l=d[a].resolve(),u=n._fieldsArray.indexOf(l),p=l.resolvedType instanceof e?"int32":l.type,h=t.basic[p];c="m"+i.safeProp(l.name),l.map?(o("if(%s!=null&&Object.hasOwnProperty.call(m,%j)){",c,l.name)("for(var ks=Object.keys(%s),i=0;i<ks.length;++i){",c),l.keyType==="bool"?o("w.uint32(%i).fork().uint32(%i).bool(util.boolFromKey(ks[i]))",(l.id<<3|2)>>>0,8|t.mapKey[l.keyType]):t.long[l.keyType]!==void 0?o("w.uint32(%i).fork().uint32(%i).%s(util.longFromKey(ks[i],%j))",(l.id<<3|2)>>>0,8|t.mapKey[l.keyType],l.keyType,l.keyType==="uint64"||l.keyType==="fixed64"):o("w.uint32(%i).fork().uint32(%i).%s(ks[i])",(l.id<<3|2)>>>0,8|t.mapKey[l.keyType],l.keyType),h===void 0?o("types[%i].encode(%s[ks[i]],w.uint32(18).fork(),q+1).ldelim().ldelim()",u,c):o(".uint32(%i).%s(%s[ks[i]]).ldelim()",16|h,p,c),o("}")("}")):l.repeated?(o("if(%s!=null&&%s.length){",c,c),l.packed&&t.packed[p]!==void 0?o("w.uint32(%i).%ss(%s)",(l.id<<3|2)>>>0,p,c):(o("for(var i=0;i<%s.length;++i)",c),h===void 0?s(o,l,u,c+"[i]"):o("w.uint32(%i).%s(%s[i])",(l.id<<3|h)>>>0,p,c)),o("}")):(l.required||(l.hasPresence||!(l.resolvedType instanceof e||t.basic[p]!==void 0)?o("if(%s!=null&&Object.hasOwnProperty.call(m,%j))",c,l.name):l.resolvedType instanceof e?o("if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&%s!==%j)",c,l.name,c,l.typeDefault):p==="bool"?o("if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&%s!==false)",c,l.name,c):p==="string"?o('if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&%s!=="")',c,l.name,c):p==="bytes"?o("if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&%s.length)",c,l.name,c):p==="double"||p==="float"?o("if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&!Object.is(%s,0))",c,l.name,c):t.long[p]!==void 0?o('if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&(typeof %s==="object"?%s.low||%s.high:%s!==0))',c,l.name,c,c,c,c):o("if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&%s!==0)",c,l.name,c)),h===void 0?s(o,l,u,c):o("w.uint32(%i).%s(%s)",(l.id<<3|h)>>>0,p,c))}return o('if(m.$unknowns!=null&&Object.hasOwnProperty.call(m,"$unknowns"))')("for(var i=0;i<m.$unknowns.length;++i)")("w.raw(m.$unknowns[i])")("return w")}return gl}var Oh;function yw(){return Oh||(Oh=1,(function(e,t){t=e.exports=hw(),t.build="light";function i(r,n,o){return typeof n=="function"?(o=n,n=new t.Root):n||(n=new t.Root),n.load(r,o)}t.load=i;function s(r,n){return n||(n=new t.Root),n.loadSync(r)}t.loadSync=s,t.encoder=rf(),t.decoder=Qp(),t.verifier=ef(),t.converter=tf(),t.ReflectionObject=Ls(),t.Namespace=Qr(),t.Root=Tc(),t.Enum=$i(),t.Type=xc(),t.Field=Ns(),t.OneOf=lr(),t.MapField=wc(),t.Service=kc(),t.Method=_c(),t.Message=Ec(),t.wrappers=sf(),t.types=Ds(),t.util=bt(),t.ReflectionObject._configure(t.Root),t.Namespace._configure(t.Type,t.Service,t.Enum),t.Root._configure(t.Type,void 0,{}),t.Field._configure(t.Type)})(gn,gn.exports)),gn.exports}var bl,Ah;function nf(){if(Ah)return bl;Ah=1,bl=l;var e=/[\s{}=;:[\],'"()<>]/g,t=/(?:"([^"\\]*(?:\\.[^"\\]*)*)")/g,i=/(?:'([^'\\]*(?:\\.[^'\\]*)*)')/g,s=/^ *[*/]+ */,r=/^\s*\*?\/*/,n=/\n/g,o=/\s/,a=/\\(.?)/g,c={0:"\0",r:"\r",n:`
`,t:"	"};function d(u){return u.replace(a,function(p,h){switch(h){case"\\":case"":return h;default:return c[h]||""}})}l.unescape=d;function l(u,p){u=u.toString();var h=0,g=u.length,f=1,m=0,b={},v=[],y=null;function w(_){return Error("illegal "+_+" (line "+f+")")}function C(){var _=y==="'"?i:t;_.lastIndex=h-1;var $=_.exec(u);if(!$)throw w("string");return h=_.lastIndex,F(y),y=null,d($[1])}function O(_){return u.charAt(_)}function M(_,$,Y){var ie={type:u.charAt(_++),lineEmpty:!1,leading:Y},oe;p?oe=2:oe=3;var _e=_-oe,ae;do if(--_e<0||(ae=u.charAt(_e))===`
`){ie.lineEmpty=!0;break}while(ae===" "||ae==="	");for(var de=u.substring(_,$).split(n),N=0;N<de.length;++N)de[N]=de[N].replace(p?r:s,"").trim();ie.text=de.join(`
`).trim(),b[f]=ie,m=f}function A(_){var $=R(_),Y=u.substring(_,$),ie=/^\s*\/\//.test(Y);return ie}function R(_){for(var $=_;$<g&&O($)!==`
`;)$++;return $}function D(){if(v.length>0)return v.shift();if(y)return C();var _,$,Y,ie,oe,_e,ae=h===0;do{if(h===g)return null;for(_=!1;o.test(Y=O(h));)if(Y===`
`&&(ae=!0,++f),++h===g)return null;if(O(h)==="/"){if(++h===g)throw w("comment");if(O(h)==="/")if(p){if(ie=h,oe=!1,A(h-1)){oe=!0;do{if(h=R(h),h===g||(h++,!ae))break;_e=A(h),_e&&f++}while(_e)}else h=Math.min(g,R(h)+1);oe&&(M(ie,h,ae),ae=!0),f++,_=!0}else{for(oe=O(ie=h+1)==="/";O(++h)!==`
`;)if(h===g)return null;++h,oe&&(M(ie,h-1,ae),ae=!0),++f,_=!0}else if((Y=O(h))==="*"){ie=h+1,oe=p||O(ie)==="*";do{if(Y===`
`&&++f,++h===g)throw w("comment");$=Y,Y=O(h)}while($!=="*"||Y!=="/");++h,oe&&(M(ie,h-2,ae),ae=!0),_=!0}else return"/"}}while(_);var de=h;e.lastIndex=0;var N=e.test(O(de++));if(!N)for(;de<g&&!e.test(O(de));)++de;var z=u.substring(h,h=de);return(z==='"'||z==="'")&&(y=z),z}function F(_){v.push(_)}function P(){if(!v.length){var _=D();if(_===null)return null;F(_)}return v[0]}function S(_,$){var Y=P(),ie=Y===_;if(ie)return D(),!0;if(!$)throw w("token '"+Y+"', '"+_+"' expected");return!1}function I(_){var $=null,Y;return _===void 0?(Y=b[f-1],delete b[f-1],Y&&(p||Y.type==="*"||Y.lineEmpty)&&($=Y.leading?Y.text:null)):(m<_&&P(),Y=b[_],delete b[_],Y&&!Y.lineEmpty&&(p||Y.type==="/")&&($=Y.leading?null:Y.text)),$}return Object.defineProperty({next:D,peek:P,push:F,skip:S,cmnt:I},"line",{get:function(){return f}})}return bl}var vl,Ih;function ww(){if(Ih)return vl;Ih=1,vl=M,M.filename=null,M.defaults={keepCase:!1};var e=nf(),t=Tc(),i=xc(),s=Ns(),r=wc(),n=lr(),o=$i(),a=kc(),c=_c(),d=Ls(),l=Ds(),u=bt(),p=/^[1-9][0-9]*$/,h=/^-?[1-9][0-9]*$/,g=/^0[x][0-9a-fA-F]+$/,f=/^-?0[x][0-9a-fA-F]+$/,m=/^0[0-7]+$/,b=/^-?0[0-7]+$/,v=u.patterns.numberRe,y=/^[a-zA-Z_][a-zA-Z_0-9]*$/,w=u.patterns.typeRefRe,C=536870911,O=2147483647;function M(A,R,D){R instanceof t||(D=R,R=new t),D||(D=M.defaults);var F=D.preferTrailingComment||!1,P=e(A,D.alternateCommentMode||!1),S=P.next,I=P.push,_=P.peek,$=P.skip,Y=P.cmnt,ie=!0,oe,_e,ae,de="proto2",N=R,z=[],H={},K=D.keepCase?function(q){return q}:u.camelCase;function ce(){z.forEach(q=>{q._edition=de,Object.keys(H).forEach(B=>{q.getOption(B)===void 0&&q.setOption(B,H[B],!0)})})}function X(q,B,G){var V=M.filename;return G||(M.filename=null),Error("illegal "+(B||"token")+" '"+q+"' ("+(V?V+", ":"")+"line "+P.line+")")}function Se(){var q=[],B;do{if((B=S())!=='"'&&B!=="'")throw X(B);q.push(S()),$(B),B=_()}while(B==='"'||B==="'");return q.join("")}function Qe(q){var B=S();switch(B){case"'":case'"':return I(B),Se();case"true":case"TRUE":return!0;case"false":case"FALSE":return!1}try{return lt(B,!0)}catch{if(w.test(B))return B;throw X(B,"value")}}function $e(q,B,G,V){var se,re;do if(B&&((se=_())==='"'||se==="'")){var Re=Se();if(q.push(Re),de>=2023)throw X(Re,"id")}else try{q.push([re=ge(S(),V,G),$("to",!0)?ge(S(),V,G):re])}catch(Ne){if(B&&w.test(se)&&de>=2023)q.push(se);else throw Ne}while($(",",!0));var ve={options:void 0};ve.setOption=function(Ne,tt){this.options===void 0&&(this.options={}),this.options[Ne]=tt},It(ve,function(tt){if(tt==="option")kt(ve,tt),$(";");else throw X(tt)},function(){Ni(ve)})}function lt(q,B){var G=1;switch(q.charAt(0)==="-"&&(G=-1,q=q.substring(1)),q){case"inf":case"INF":case"Inf":return G*(1/0);case"nan":case"NAN":case"Nan":case"NaN":return NaN;case"0":return 0}if(p.test(q))return G*parseInt(q,10);if(g.test(q))return G*parseInt(q,16);if(m.test(q))return G*parseInt(q,8);if(v.test(q))return G*parseFloat(q);throw X(q,"number",B)}function ge(q,B,G){if(q===null)throw X(q,"end of input");switch(q){case"max":case"MAX":case"Max":return G||C;case"0":return 0}if(!B&&q.charAt(0)==="-")throw X(q,"id");if(h.test(q))return parseInt(q,10);if(f.test(q))return parseInt(q,16);if(b.test(q))return parseInt(q,8);throw X(q,"id")}function pi(){if(oe!==void 0)throw X("package");if(oe=S(),oe===null||!w.test(oe))throw X(oe,"name");N=N.define(oe),$(";")}function Be(){var q=_(),B;switch(q){case"option":if(de<"2024")throw X("option");S(),Se(),$(";");return;case"weak":B=ae||(ae=[]),S();break;case"public":S();default:B=_e||(_e=[]);break}q=Se(),$(";"),B.push(q)}function fi(){if($("="),de=Se(),de<2023)throw X(de,"syntax");$(";")}function en(){if($("="),de=Se(),!["2023","2024"].includes(de))throw X(de,"edition");$(";")}function Nt(q,B,G){switch(G===void 0&&(G=0),B){case"option":return kt(q,B),$(";"),!0;case"message":return ji(q,B,G+1),!0;case"enum":return bi(q,B),!0;case"export":case"local":return de<"2024"||(B=S(),B==="export"||B==="local")||B!=="message"&&B!=="enum"?!1:Nt(q,B,G);case"service":return Ms(q,B,G+1),!0;case"extend":return rn(q,B,G),!0}return!1}function It(q,B,G){var V=P.line;if(q&&(typeof q.comment!="string"&&(q.comment=Y()),q.filename=M.filename),$("{",!0)){for(var se;(se=S())!=="}";)B(se);$(";",!0)}else G&&G(),$(";"),q&&(typeof q.comment!="string"||F)&&(q.comment=Y(V)||q.comment)}function ji(q,B,G){if(G===void 0&&(G=0),G>u.nestingLimit)throw Error("max depth exceeded");if((B=S())===null||!y.test(B))throw X(B,"type name");var V=new i(B);It(V,function(re){if(!Nt(V,re,G))switch(re){case";":break;case"map":mi(V);break;case"required":if(de!=="proto2")throw X(re);case"repeated":_t(V,re,void 0,G+1);break;case"optional":if(de==="proto3")_t(V,"proto3_optional",void 0,G+1);else{if(de!=="proto2")throw X(re);_t(V,"optional",void 0,G+1)}break;case"oneof":gi(V,re,G+1);break;case"extensions":$e(V.extensions||(V.extensions=[]));break;case"reserved":$e(V.reserved||(V.reserved=[]),!0);break;default:if(de==="proto2"||!w.test(re))throw X(re);I(re),_t(V,"optional",void 0,G+1);break}}),q.add(V),q===N&&z.push(V)}function _t(q,B,G,V){var se=S();if(se===null)throw X(se,"end of input");if(se==="group"){tn(q,B,G,V);return}for(;se.endsWith(".")||(_()||"").startsWith(".");){var re=S();if(re===null)throw X(re,"end of input");se+=re}if(!w.test(se))throw X(se,"type");var Re=S();if(Re===null)throw X(Re,"end of input");if(!y.test(Re))throw X(Re,"name");var ve=Re;Re=K(Re),$("=");var Ne=new s(Re,ge(S()),se,B==="proto3_optional"?"optional":B,G);if(ve!==Re&&(Ne.protoName=ve),It(Ne,function(it){if(it==="option")kt(Ne,it),$(";");else throw X(it)},function(){Ni(Ne)}),B==="proto3_optional"){var tt=new n("_"+Re);Ne.setOption("proto3_optional",!0),tt.add(Ne),q.add(tt)}else q.add(Ne);q===N&&z.push(Ne)}function tn(q,B,G,V){if(V===void 0&&(V=0),V>u.nestingLimit)throw Error("max depth exceeded");if(de>=2023)throw X("group");var se=S();if(se===null||!y.test(se))throw X(se,"name");var re=u.lcFirst(se);se===re&&(se=u.ucFirst(se)),$("=");var Re=ge(S()),ve=new i(se);ve.group=!0;var Ne=new s(re,Re,se,B,G);Ne.filename=M.filename,It(ve,function(Xe){switch(Xe){case";":break;case"option":kt(ve,Xe),$(";");break;case"required":case"repeated":_t(ve,Xe,void 0,V+1);break;case"optional":de==="proto3"?_t(ve,"proto3_optional",void 0,V+1):_t(ve,"optional",void 0,V+1);break;case"message":ji(ve,Xe,V+1);break;case"enum":bi(ve,Xe);break;case"reserved":$e(ve.reserved||(ve.reserved=[]),!0);break;case"export":case"local":if(de<"2024")throw X(Xe);switch(Xe=S(),Xe){case"message":ji(ve,Xe,V+1);break;case"enum":ji(ve,Xe,V+1);break;default:throw X(Xe)}break;default:throw X(Xe)}}),q.add(ve).add(Ne),q===N&&(z.push(ve),z.push(Ne))}function mi(q){$("<");var B=S();if(l.mapKey[B]===void 0)throw X(B,"type");$(",");var G=S();if(!w.test(G))throw X(G,"type");$(">");var V=S();if(V===null||!y.test(V))throw X(V,"name");$("=");var se=V;V=K(V);var re=new r(V,ge(S()),B,G);se!==V&&(re.protoName=se),It(re,function(ve){if(ve==="option")kt(re,ve),$(";");else throw X(ve)},function(){Ni(re)}),q.add(re)}function gi(q,B,G){if((B=S())===null||!y.test(B))throw X(B,"name");var V=new n(K(B));It(V,function(re){re==="option"?(kt(V,re),$(";")):(I(re),_t(V,"optional",void 0,G))}),q.add(V)}function bi(q,B){if((B=S())===null||!y.test(B))throw X(B,"name");var G=new o(B);It(G,function(se){switch(se){case";":break;case"option":kt(G,se),$(";");break;case"reserved":$e(G.reserved||(G.reserved=[]),!0,O,!0),G.reserved===void 0&&(G.reserved=[]);break;default:dr(G,se)}}),q.add(G),q===N&&z.push(G)}function dr(q,B){if(!y.test(B))throw X(B,"name");$("=");var G=ge(S(),!0),V={options:void 0};V.getOption=function(se){return this.options[se]},V.setOption=function(se,re){d.prototype.setOption.call(V,se,re)},V.setParsedOption=function(){},It(V,function(re){if(re==="option")kt(V,re),$(";");else throw X(re)},function(){Ni(V)}),q.add(B,G,V.comment,V.parsedOptions||V.options)}function kt(q,B){var G,V,se=!0;for(B==="option"&&(B=S());B!=="=";){if(B===null)throw X(B,"end of input");if(B==="("){var re=S();$(")"),B="("+re+")"}if(se){if(se=!1,B.includes(".")&&!B.includes("(")){var Re=B.split(".");G=Re[0]+".",B=Re[1];continue}G=B}else V=V?V+=B:B;B=S()}var ve=V?G.concat(V):G,Ne=Ps(q,ve);V=V&&V[0]==="."?V.slice(1):V,G=G&&G[G.length-1]==="."?G.slice(0,-1):G,Gi(q,G,Ne,V)}function Ps(q,B,G){if(G===void 0&&(G=0),G>u.recursionLimit)throw Error("max depth exceeded");if($("{",!0)){for(var V={};!$("}",!0);){if(!y.test(et=S()))throw X(et,"name");if(et===null)throw X(et,"end of input");var se,re=et;if($(":",!0),_()==="{")se=Ps(q,B+"."+et,G+1);else if(_()==="["){se=[];var Re;if($("[",!0)&&!$("]",!0)){do Re=Qe(),se.push(Re);while($(",",!0));$("]"),typeof Re<"u"&&us(q,B+"."+et,Re)}}else se=Qe(),us(q,B+"."+et,se);var ve=Object.prototype.hasOwnProperty.call(V,re)?V[re]:void 0;ve&&(se=[].concat(ve).concat(se)),re!=="__proto__"&&(V[re]=se),$(",",!0),$(";",!0)}return V}var Ne=Qe();return us(q,B,Ne),Ne}function us(q,B,G){if(N===q&&/^features\./.test(B)){H[B]=G;return}B==="json_name"&&q instanceof s&&(q.jsonName=G),q.setOption&&q.setOption(B,G)}function Gi(q,B,G,V){q.setParsedOption&&q.setParsedOption(B,G,V)}function Ni(q){if($("[",!0)){do kt(q,"option");while($(",",!0));$("]")}return q}function Ms(q,B,G){if(G===void 0&&(G=0),G>u.recursionLimit)throw Error("max depth exceeded");if((B=S())===null||!y.test(B))throw X(B,"service name");var V=new a(B);It(V,function(re){if(!Nt(V,re,G)&&re!==";")if(re==="rpc")sn(V,re);else throw X(re)}),q.add(V),q===N&&z.push(V)}function sn(q,B){var G=Y(),V=B;if(!y.test(B=S()))throw X(B,"name");var se=B,re,Re,ve,Ne;if($("("),$("stream",!0)&&(Re=!0),!w.test(B=S())||(re=B,$(")"),$("returns"),$("("),$("stream",!0)&&(Ne=!0),!w.test(B=S())))throw X(B);ve=B,$(")");var tt=new c(se,V,re,ve,Re,Ne);tt.comment=G,It(tt,function(it){if(it!==";")if(it==="option")kt(tt,it),$(";");else throw X(it)}),q.add(tt)}function rn(q,B,G){if((B=S())===null||!w.test(B))throw X(B,"reference");var V=B;It(null,function(re){switch(re){case"required":case"repeated":_t(q,re,V,G+1);break;case"optional":de==="proto3"?_t(q,"proto3_optional",V,G+1):_t(q,"optional",V,G+1);break;default:if(de==="proto2"||!w.test(re))throw X(re);I(re),_t(q,"optional",V,G+1);break}})}for(var et;(et=S())!==null;)switch(et){case";":break;case"package":if(!ie)throw X(et);pi();break;case"import":Be();break;case"syntax":if(!ie)throw X(et);fi();break;case"edition":if(!ie)throw X(et);en();break;case"option":kt(N,et),$(";",!0);break;default:if(Nt(N,et,0)){ie=!1;continue}throw X(et)}return ce(),M.filename=null,{package:oe,imports:_e,weakImports:ae,root:R}}return vl}var yl,Rh;function _w(){if(Rh)return yl;Rh=1,yl=t;var e=/\/|\./;function t(s,r){e.test(s)||(s="google/protobuf/"+s+".proto",r={nested:{google:{nested:{protobuf:{nested:r}}}}}),t[s]=r}t("any",{Any:{fields:{type_url:{type:"string",id:1},value:{type:"bytes",id:2}}}});var i;return t("duration",{Duration:i={fields:{seconds:{type:"int64",id:1},nanos:{type:"int32",id:2}}}}),t("timestamp",{Timestamp:i}),t("empty",{Empty:{fields:{}}}),t("struct",{Struct:{fields:{fields:{keyType:"string",type:"Value",id:1}}},Value:{oneofs:{kind:{oneof:["nullValue","numberValue","stringValue","boolValue","structValue","listValue"]}},fields:{nullValue:{type:"NullValue",id:1},numberValue:{type:"double",id:2},stringValue:{type:"string",id:3},boolValue:{type:"bool",id:4},structValue:{type:"Struct",id:5},listValue:{type:"ListValue",id:6}}},NullValue:{values:{NULL_VALUE:0}},ListValue:{fields:{values:{rule:"repeated",type:"Value",id:1}}}}),t("wrappers",{DoubleValue:{fields:{value:{type:"double",id:1}}},FloatValue:{fields:{value:{type:"float",id:1}}},Int64Value:{fields:{value:{type:"int64",id:1}}},UInt64Value:{fields:{value:{type:"uint64",id:1}}},Int32Value:{fields:{value:{type:"int32",id:1}}},UInt32Value:{fields:{value:{type:"uint32",id:1}}},BoolValue:{fields:{value:{type:"bool",id:1}}},StringValue:{fields:{value:{type:"string",id:1}}},BytesValue:{fields:{value:{type:"bytes",id:1}}}}),t("field_mask",{FieldMask:{fields:{paths:{rule:"repeated",type:"string",id:1}}}}),t.get=function(r){return t[r]||null},yl}var $h;function kw(){return $h||($h=1,(function(e,t){t=e.exports=yw(),t.build="full",t.tokenize=nf(),t.parse=ww(),t.common=_w(),t.Root._configure(t.Type,t.parse,t.common)})(mn,mn.exports)),mn.exports}var wl,Dh;function Ew(){return Dh||(Dh=1,wl=kw()),wl}var xw=Ew();const Tw=kp(xw),Cw=JSON.parse('{"farmtable":{"nested":{"v1":{"options":{"go_package":"go.farmtable.dev/api/gen/farmtable/v1;farmtablev1"},"nested":{"Platform":{"values":{"PLATFORM_UNSPECIFIED":0,"PLATFORM_FARMTABLE":1,"PLATFORM_GITHUB":2,"PLATFORM_LINEAR":3,"PLATFORM_JIRA":4,"PLATFORM_ASANA":5,"PLATFORM_BEADS":6}},"TaskPhase":{"values":{"TASK_PHASE_UNSPECIFIED":0,"TASK_PHASE_OPEN":1,"TASK_PHASE_IN_PROGRESS":2,"TASK_PHASE_ON_HOLD":3,"TASK_PHASE_CLOSED":4}},"TaskStage":{"values":{"TASK_STAGE_UNSPECIFIED":0,"TASK_STAGE_TRIAGE":1,"TASK_STAGE_ACCEPTED":2,"TASK_STAGE_WORKING":4,"TASK_STAGE_IN_REVIEW":5,"TASK_STAGE_IN_QA":6,"TASK_STAGE_DEPLOYING":7,"TASK_STAGE_COMPLETED":12,"TASK_STAGE_WONT_FIX":13,"TASK_STAGE_DUPLICATE":14,"TASK_STAGE_CANCELLED":15}},"TaskHoldReason":{"values":{"TASK_HOLD_REASON_UNSPECIFIED":0,"TASK_HOLD_REASON_WAITING_FOR_INPUT":1,"TASK_HOLD_REASON_DEFERRED":2}},"AvailabilityReason":{"values":{"AVAILABILITY_REASON_UNSPECIFIED":0,"AVAILABILITY_REASON_TRIAGE":1,"AVAILABILITY_REASON_TERMINAL":2,"AVAILABILITY_REASON_HELD":3,"AVAILABILITY_REASON_BLOCKED_BY_DEPENDENCY":4,"AVAILABILITY_REASON_FUTURE_START_DATE":5}},"TaskPriority":{"values":{"TASK_PRIORITY_UNSPECIFIED":0,"TASK_PRIORITY_URGENT":1,"TASK_PRIORITY_HIGH":2,"TASK_PRIORITY_NORMAL":3,"TASK_PRIORITY_LOW":4}},"RelationshipType":{"values":{"RELATIONSHIP_TYPE_UNSPECIFIED":0,"RELATIONSHIP_TYPE_BLOCKS":1,"RELATIONSHIP_TYPE_BLOCKED_BY":2,"RELATIONSHIP_TYPE_RELATED":3,"RELATIONSHIP_TYPE_DUPLICATE":4}},"UserType":{"values":{"USER_TYPE_UNSPECIFIED":0,"USER_TYPE_HUMAN":1,"USER_TYPE_AGENT":2,"USER_TYPE_SERVICE_ACCOUNT":3}},"IdentityStatus":{"values":{"IDENTITY_STATUS_UNSPECIFIED":0,"IDENTITY_STATUS_ACTIVE":1,"IDENTITY_STATUS_SUSPENDED":2,"IDENTITY_STATUS_ARCHIVED":3}},"AuthMethod":{"values":{"AUTH_METHOD_UNSPECIFIED":0,"AUTH_METHOD_OAUTH2_PKCE":1,"AUTH_METHOD_API_KEY":2,"AUTH_METHOD_PAT":3,"AUTH_METHOD_SERVICE_ACCOUNT":4,"AUTH_METHOD_MCP_OAUTH":5,"AUTH_METHOD_GITHUB_APP":6,"AUTH_METHOD_ATLASSIAN_CONNECT":7,"AUTH_METHOD_LOCAL_PROCESS":8}},"CustomFieldType":{"values":{"CUSTOM_FIELD_TYPE_UNSPECIFIED":0,"CUSTOM_FIELD_TYPE_TEXT":1,"CUSTOM_FIELD_TYPE_NUMBER":2,"CUSTOM_FIELD_TYPE_DATE":3,"CUSTOM_FIELD_TYPE_SINGLE_SELECT":4,"CUSTOM_FIELD_TYPE_MULTI_SELECT":5,"CUSTOM_FIELD_TYPE_USER":6,"CUSTOM_FIELD_TYPE_BOOLEAN":7,"CUSTOM_FIELD_TYPE_URL":8}},"CIStatus":{"values":{"CI_STATUS_UNSPECIFIED":0,"CI_STATUS_PENDING":1,"CI_STATUS_RUNNING":2,"CI_STATUS_PASSED":3,"CI_STATUS_FAILED":4}},"PullRequestStatus":{"values":{"PULL_REQUEST_STATUS_UNSPECIFIED":0,"PULL_REQUEST_STATUS_OPEN":1,"PULL_REQUEST_STATUS_MERGED":2,"PULL_REQUEST_STATUS_CLOSED":3}},"EventType":{"values":{"EVENT_TYPE_UNSPECIFIED":0,"EVENT_TYPE_TASK_CREATED":1,"EVENT_TYPE_TASK_UPDATED":2,"EVENT_TYPE_TASK_DELETED":3,"EVENT_TYPE_TASK_PHASE_CHANGED":4,"EVENT_TYPE_TASK_STAGE_CHANGED":5,"EVENT_TYPE_TASK_ASSIGNED":6,"EVENT_TYPE_COMMENT_CREATED":7,"EVENT_TYPE_COMMENT_UPDATED":8}},"WebhookSource":{"values":{"WEBHOOK_SOURCE_UNSPECIFIED":0,"WEBHOOK_SOURCE_NATIVE":1,"WEBHOOK_SOURCE_VIRTUAL":2}},"SortField":{"values":{"SORT_FIELD_UNSPECIFIED":0,"SORT_FIELD_CREATED":1,"SORT_FIELD_UPDATED":2,"SORT_FIELD_PRIORITY":3,"SORT_FIELD_DUE_DATE":4}},"SortOrder":{"values":{"SORT_ORDER_UNSPECIFIED":0,"SORT_ORDER_ASC":1,"SORT_ORDER_DESC":2}},"DependencyDirection":{"values":{"DEPENDENCY_DIRECTION_UNSPECIFIED":0,"DEPENDENCY_DIRECTION_UP":1,"DEPENDENCY_DIRECTION_DOWN":2,"DEPENDENCY_DIRECTION_BOTH":3}},"TaskEventType":{"values":{"TASK_EVENT_TYPE_UNSPECIFIED":0,"TASK_EVENT_TYPE_INITIAL":1,"TASK_EVENT_TYPE_CREATED":2,"TASK_EVENT_TYPE_UPDATED":3,"TASK_EVENT_TYPE_CLOSED":4,"TASK_EVENT_TYPE_DELETED":5,"TASK_EVENT_TYPE_HEARTBEAT":6,"TASK_EVENT_TYPE_SNAPSHOT_COMPLETE":7}},"User":{"oneofs":{"_email":{"oneof":["email"]},"_remoteId":{"oneof":["remoteId"]},"_platform":{"oneof":["platform"]}},"fields":{"id":{"type":"string","id":1,"options":{"(buf.validate.field).string.uuid":true}},"name":{"type":"string","id":2,"options":{"(buf.validate.field).string.min_len":1}},"email":{"type":"string","id":3,"options":{"(buf.validate.field).string.email":true,"proto3_optional":true}},"type":{"type":"UserType","id":4,"options":{"(buf.validate.field).enum.defined_only":true,"(buf.validate.field).enum.not_in":0}},"status":{"type":"IdentityStatus","id":5,"options":{"(buf.validate.field).enum.defined_only":true,"(buf.validate.field).enum.not_in":0}},"remoteId":{"type":"string","id":6,"protoName":"remote_id","options":{"proto3_optional":true}},"platform":{"type":"Platform","id":7,"options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}}}},"Relationship":{"fields":{"type":{"type":"RelationshipType","id":1,"options":{"(buf.validate.field).enum.defined_only":true,"(buf.validate.field).enum.not_in":0}},"targetTaskId":{"type":"string","id":2,"protoName":"target_task_id","options":{"(buf.validate.field).string.uuid":true}}}},"Attachment":{"oneofs":{"_contentType":{"oneof":["contentType"]},"_sizeBytes":{"oneof":["sizeBytes"]}},"fields":{"id":{"type":"string","id":1,"options":{"(buf.validate.field).string.uuid":true}},"filename":{"type":"string","id":2,"options":{"(buf.validate.field).string.min_len":1}},"url":{"type":"string","id":3,"options":{"(buf.validate.field).string.uri":true}},"contentType":{"type":"string","id":4,"protoName":"content_type","options":{"proto3_optional":true}},"sizeBytes":{"type":"int64","id":5,"protoName":"size_bytes","options":{"(buf.validate.field).int64.gte":0,"proto3_optional":true}}}},"CustomFieldValue":{"fields":{"fieldId":{"type":"string","id":1,"protoName":"field_id","options":{"(buf.validate.field).string.min_len":1}},"fieldName":{"type":"string","id":2,"protoName":"field_name","options":{"(buf.validate.field).string.min_len":1}},"fieldType":{"type":"CustomFieldType","id":3,"protoName":"field_type","options":{"(buf.validate.field).enum.defined_only":true,"(buf.validate.field).enum.not_in":0}},"value":{"type":"google.protobuf.Value","id":4,"options":{"(buf.validate.field).required":true}}}},"CustomFieldDefinition":{"fields":{"fieldId":{"type":"string","id":1,"protoName":"field_id","options":{"(buf.validate.field).string.min_len":1}},"fieldName":{"type":"string","id":2,"protoName":"field_name","options":{"(buf.validate.field).string.min_len":1}},"fieldType":{"type":"CustomFieldType","id":3,"protoName":"field_type","options":{"(buf.validate.field).enum.defined_only":true,"(buf.validate.field).enum.not_in":0}},"required":{"type":"bool","id":4}}},"PullRequest":{"fields":{"id":{"type":"string","id":1,"options":{"(buf.validate.field).string.min_len":1}},"url":{"type":"string","id":2,"options":{"(buf.validate.field).string.uri":true}},"status":{"type":"PullRequestStatus","id":3,"options":{"(buf.validate.field).enum.defined_only":true,"(buf.validate.field).enum.not_in":0}}}},"CodeContext":{"oneofs":{"_repo":{"oneof":["repo"]},"_branch":{"oneof":["branch"]},"_ciStatus":{"oneof":["ciStatus"]}},"fields":{"repo":{"type":"string","id":1,"options":{"proto3_optional":true}},"branch":{"type":"string","id":2,"options":{"proto3_optional":true}},"pullRequests":{"rule":"repeated","type":"PullRequest","id":3,"protoName":"pull_requests"},"ciStatus":{"type":"CIStatus","id":4,"protoName":"ci_status","options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}},"commitShas":{"rule":"repeated","type":"string","id":5,"protoName":"commit_shas"}}},"StatusMapping":{"fields":{"nativeStatus":{"type":"string","id":1,"protoName":"native_status","options":{"(buf.validate.field).string.min_len":1}},"phase":{"type":"TaskPhase","id":2,"options":{"(buf.validate.field).enum.defined_only":true,"(buf.validate.field).enum.not_in":0}},"stage":{"type":"TaskStage","id":3,"options":{"(buf.validate.field).enum.defined_only":true,"(buf.validate.field).enum.not_in":0}}}},"Task":{"oneofs":{"_description":{"oneof":["description"]},"_acceptanceCriteria":{"oneof":["acceptanceCriteria"]},"_nativeStatus":{"oneof":["nativeStatus"]},"_type":{"oneof":["type"]},"_priority":{"oneof":["priority"]},"_creator":{"oneof":["creator"]},"_parentTaskId":{"oneof":["parentTaskId"]},"_codeContext":{"oneof":["codeContext"]},"_remoteId":{"oneof":["remoteId"]},"_remoteUrl":{"oneof":["remoteUrl"]},"_holdReason":{"oneof":["holdReason"]},"_rank":{"oneof":["rank"]}},"fields":{"id":{"type":"string","id":1,"options":{"(buf.validate.field).string.uuid":true}},"name":{"type":"string","id":2,"options":{"(buf.validate.field).string.min_len":1}},"description":{"type":"string","id":3,"options":{"proto3_optional":true}},"acceptanceCriteria":{"type":"string","id":4,"protoName":"acceptance_criteria","options":{"proto3_optional":true}},"phase":{"type":"TaskPhase","id":5,"options":{"(buf.validate.field).enum.defined_only":true,"(buf.validate.field).enum.not_in":0}},"stage":{"type":"TaskStage","id":6,"options":{"(buf.validate.field).enum.defined_only":true,"(buf.validate.field).enum.not_in":0}},"nativeStatus":{"type":"string","id":7,"protoName":"native_status","options":{"proto3_optional":true}},"type":{"type":"string","id":8,"options":{"proto3_optional":true}},"priority":{"type":"TaskPriority","id":9,"options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}},"assignees":{"rule":"repeated","type":"User","id":10},"creator":{"type":"User","id":11,"options":{"proto3_optional":true}},"startDate":{"type":"google.protobuf.Timestamp","id":12,"protoName":"start_date"},"dueDate":{"type":"google.protobuf.Timestamp","id":13,"protoName":"due_date"},"collectionId":{"type":"string","id":14,"protoName":"collection_id","options":{"(buf.validate.field).string.uuid":true}},"parentTaskId":{"type":"string","id":15,"protoName":"parent_task_id","options":{"(buf.validate.field).string.uuid":true,"proto3_optional":true}},"relationships":{"rule":"repeated","type":"Relationship","id":16},"labels":{"rule":"repeated","type":"string","id":17},"customFields":{"rule":"repeated","type":"CustomFieldValue","id":18,"protoName":"custom_fields"},"codeContext":{"type":"CodeContext","id":19,"protoName":"code_context","options":{"proto3_optional":true}},"remoteId":{"type":"string","id":20,"protoName":"remote_id","options":{"proto3_optional":true}},"remoteUrl":{"type":"string","id":21,"protoName":"remote_url","options":{"(buf.validate.field).string.uri":true,"proto3_optional":true}},"remoteData":{"type":"google.protobuf.Struct","id":22,"protoName":"remote_data"},"platform":{"type":"Platform","id":23,"options":{"(buf.validate.field).enum.defined_only":true,"(buf.validate.field).enum.not_in":0}},"createdAt":{"type":"google.protobuf.Timestamp","id":24,"protoName":"created_at","options":{"(buf.validate.field).required":true}},"updatedAt":{"type":"google.protobuf.Timestamp","id":25,"protoName":"updated_at"},"closedAt":{"type":"google.protobuf.Timestamp","id":26,"protoName":"closed_at"},"version":{"type":"string","id":27},"holdReason":{"type":"TaskHoldReason","id":28,"protoName":"hold_reason","options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}},"rank":{"type":"int64","id":29,"options":{"proto3_optional":true}},"availability":{"type":"TaskAvailability","id":30}}},"TaskAvailability":{"fields":{"available":{"type":"bool","id":1},"reasons":{"rule":"repeated","type":"AvailabilityReason","id":2}}},"Collection":{"oneofs":{"_description":{"oneof":["description"]},"_remoteId":{"oneof":["remoteId"]},"_workspaceId":{"oneof":["workspaceId"]},"_linkedAccountId":{"oneof":["linkedAccountId"]}},"fields":{"id":{"type":"string","id":1,"options":{"(buf.validate.field).string.uuid":true}},"name":{"type":"string","id":2,"options":{"(buf.validate.field).string.min_len":1}},"description":{"type":"string","id":3,"options":{"proto3_optional":true}},"platform":{"type":"Platform","id":4,"options":{"(buf.validate.field).enum.defined_only":true,"(buf.validate.field).enum.not_in":0}},"remoteId":{"type":"string","id":5,"protoName":"remote_id","options":{"proto3_optional":true}},"workspaceId":{"type":"string","id":6,"protoName":"workspace_id","options":{"proto3_optional":true}},"linkedAccountId":{"type":"string","id":7,"protoName":"linked_account_id","options":{"(buf.validate.field).string.uuid":true,"proto3_optional":true}},"statusMappings":{"rule":"repeated","type":"StatusMapping","id":8,"protoName":"status_mappings"},"customFieldDefinitions":{"rule":"repeated","type":"CustomFieldDefinition","id":9,"protoName":"custom_field_definitions"},"remoteData":{"type":"google.protobuf.Struct","id":10,"protoName":"remote_data"},"createdAt":{"type":"google.protobuf.Timestamp","id":11,"protoName":"created_at","options":{"(buf.validate.field).required":true}},"updatedAt":{"type":"google.protobuf.Timestamp","id":12,"protoName":"updated_at"}}},"Comment":{"oneofs":{"_remoteId":{"oneof":["remoteId"]}},"fields":{"id":{"type":"string","id":1,"options":{"(buf.validate.field).string.uuid":true}},"taskId":{"type":"string","id":2,"protoName":"task_id","options":{"(buf.validate.field).string.uuid":true}},"author":{"type":"User","id":3,"options":{"(buf.validate.field).required":true}},"body":{"type":"string","id":4,"options":{"(buf.validate.field).string.min_len":1}},"attachments":{"rule":"repeated","type":"Attachment","id":5},"createdAt":{"type":"google.protobuf.Timestamp","id":6,"protoName":"created_at","options":{"(buf.validate.field).required":true}},"updatedAt":{"type":"google.protobuf.Timestamp","id":7,"protoName":"updated_at"},"remoteId":{"type":"string","id":8,"protoName":"remote_id","options":{"proto3_optional":true}}}},"Change":{"oneofs":{"_reason":{"oneof":["reason"]}},"fields":{"id":{"type":"string","id":1,"options":{"(buf.validate.field).string.uuid":true}},"taskId":{"type":"string","id":2,"protoName":"task_id","options":{"(buf.validate.field).string.uuid":true}},"field":{"type":"string","id":3,"options":{"(buf.validate.field).string.min_len":1}},"oldValue":{"type":"google.protobuf.Value","id":4,"protoName":"old_value"},"newValue":{"type":"google.protobuf.Value","id":5,"protoName":"new_value","options":{"(buf.validate.field).required":true}},"changedBy":{"type":"User","id":6,"protoName":"changed_by","options":{"(buf.validate.field).required":true}},"changedAt":{"type":"google.protobuf.Timestamp","id":7,"protoName":"changed_at","options":{"(buf.validate.field).required":true}},"reason":{"type":"string","id":8,"options":{"proto3_optional":true}}}},"LinkedAccount":{"oneofs":{"_remoteUserId":{"oneof":["remoteUserId"]}},"fields":{"id":{"type":"string","id":1,"options":{"(buf.validate.field).string.uuid":true}},"platform":{"type":"Platform","id":2,"options":{"(buf.validate.field).enum.defined_only":true,"(buf.validate.field).enum.not_in":0}},"authMethod":{"type":"AuthMethod","id":3,"protoName":"auth_method","options":{"(buf.validate.field).enum.defined_only":true,"(buf.validate.field).enum.not_in":0}},"scopes":{"rule":"repeated","type":"string","id":4},"remoteUserId":{"type":"string","id":5,"protoName":"remote_user_id","options":{"proto3_optional":true}},"status":{"type":"IdentityStatus","id":6,"options":{"(buf.validate.field).enum.defined_only":true,"(buf.validate.field).enum.not_in":0}},"createdAt":{"type":"google.protobuf.Timestamp","id":7,"protoName":"created_at","options":{"(buf.validate.field).required":true}},"expiresAt":{"type":"google.protobuf.Timestamp","id":8,"protoName":"expires_at"}}},"WebhookEvent":{"fields":{"id":{"type":"string","id":1,"options":{"(buf.validate.field).string.uuid":true}},"eventType":{"type":"EventType","id":2,"protoName":"event_type","options":{"(buf.validate.field).enum.defined_only":true,"(buf.validate.field).enum.not_in":0}},"taskId":{"type":"string","id":3,"protoName":"task_id","options":{"(buf.validate.field).string.uuid":true}},"changes":{"rule":"repeated","type":"Change","id":4},"triggeredBy":{"type":"User","id":5,"protoName":"triggered_by"},"platform":{"type":"Platform","id":6,"options":{"(buf.validate.field).enum.defined_only":true,"(buf.validate.field).enum.not_in":0}},"source":{"type":"WebhookSource","id":7,"options":{"(buf.validate.field).enum.defined_only":true,"(buf.validate.field).enum.not_in":0}},"timestamp":{"type":"google.protobuf.Timestamp","id":8,"options":{"(buf.validate.field).required":true}}}},"ListTasksRequest":{"oneofs":{"_collectionId":{"oneof":["collectionId"]},"_phase":{"oneof":["phase"]},"_assignee":{"oneof":["assignee"]},"_priority":{"oneof":["priority"]},"_type":{"oneof":["type"]},"_parentTaskId":{"oneof":["parentTaskId"]}},"fields":{"collectionId":{"type":"string","id":1,"protoName":"collection_id","options":{"(buf.validate.field).string.uuid":true,"proto3_optional":true}},"phase":{"type":"TaskPhase","id":2,"options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}},"stages":{"rule":"repeated","type":"TaskStage","id":3},"assignee":{"type":"string","id":4,"options":{"proto3_optional":true}},"priority":{"type":"TaskPriority","id":5,"options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}},"type":{"type":"string","id":6,"options":{"proto3_optional":true}},"labels":{"rule":"repeated","type":"string","id":7},"parentTaskId":{"type":"string","id":8,"protoName":"parent_task_id","options":{"(buf.validate.field).string.uuid":true,"proto3_optional":true}},"sortField":{"type":"SortField","id":9,"protoName":"sort_field"},"sortOrder":{"type":"SortOrder","id":10,"protoName":"sort_order"},"full":{"type":"bool","id":11},"pageSize":{"type":"int32","id":12,"protoName":"page_size","options":{"(buf.validate.field).int32.gte":1,"(buf.validate.field).int32.lte":200}},"pageToken":{"type":"string","id":13,"protoName":"page_token"}}},"ListTasksResponse":{"fields":{"items":{"rule":"repeated","type":"Task","id":1},"nextPageToken":{"type":"string","id":2,"protoName":"next_page_token"},"hasMore":{"type":"bool","id":3,"protoName":"has_more"},"totalCount":{"type":"int32","id":4,"protoName":"total_count"}}},"GetTaskRequest":{"oneofs":{"_collectionId":{"oneof":["collectionId"]}},"fields":{"id":{"type":"string","id":1,"options":{"(buf.validate.field).string.min_len":1}},"includeComments":{"type":"bool","id":2,"protoName":"include_comments"},"includeChanges":{"type":"bool","id":3,"protoName":"include_changes"},"collectionId":{"type":"string","id":4,"protoName":"collection_id","options":{"(buf.validate.field).string.uuid":true,"proto3_optional":true}}}},"GetTaskResponse":{"fields":{"task":{"type":"Task","id":1},"comments":{"rule":"repeated","type":"Comment","id":2},"changes":{"rule":"repeated","type":"Change","id":3}}},"CreateTaskRequest":{"oneofs":{"_description":{"oneof":["description"]},"_acceptanceCriteria":{"oneof":["acceptanceCriteria"]},"_stage":{"oneof":["stage"]},"_priority":{"oneof":["priority"]},"_type":{"oneof":["type"]},"_parentTaskId":{"oneof":["parentTaskId"]},"_holdReason":{"oneof":["holdReason"]},"_rank":{"oneof":["rank"]},"_repo":{"oneof":["repo"]},"_branch":{"oneof":["branch"]},"_reason":{"oneof":["reason"]}},"fields":{"name":{"type":"string","id":1,"options":{"(buf.validate.field).string.min_len":1}},"collectionId":{"type":"string","id":2,"protoName":"collection_id","options":{"(buf.validate.field).string.uuid":true}},"description":{"type":"string","id":3,"options":{"proto3_optional":true}},"acceptanceCriteria":{"type":"string","id":4,"protoName":"acceptance_criteria","options":{"proto3_optional":true}},"stage":{"type":"TaskStage","id":5,"options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}},"priority":{"type":"TaskPriority","id":6,"options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}},"type":{"type":"string","id":7,"options":{"proto3_optional":true}},"assigneeIds":{"rule":"repeated","type":"string","id":8,"protoName":"assignee_ids"},"labels":{"rule":"repeated","type":"string","id":9},"parentTaskId":{"type":"string","id":10,"protoName":"parent_task_id","options":{"(buf.validate.field).string.uuid":true,"proto3_optional":true}},"dueDate":{"type":"google.protobuf.Timestamp","id":11,"protoName":"due_date"},"startDate":{"type":"google.protobuf.Timestamp","id":12,"protoName":"start_date"},"blocksTaskIds":{"rule":"repeated","type":"string","id":13,"protoName":"blocks_task_ids"},"blockedByTaskIds":{"rule":"repeated","type":"string","id":14,"protoName":"blocked_by_task_ids"},"repo":{"type":"string","id":15,"options":{"proto3_optional":true}},"branch":{"type":"string","id":16,"options":{"proto3_optional":true}},"reason":{"type":"string","id":17,"options":{"proto3_optional":true}},"holdReason":{"type":"TaskHoldReason","id":18,"protoName":"hold_reason","options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}},"rank":{"type":"int64","id":19,"options":{"proto3_optional":true}}}},"UpdateTaskRequest":{"oneofs":{"_name":{"oneof":["name"]},"_description":{"oneof":["description"]},"_acceptanceCriteria":{"oneof":["acceptanceCriteria"]},"_stage":{"oneof":["stage"]},"_priority":{"oneof":["priority"]},"_type":{"oneof":["type"]},"_holdReason":{"oneof":["holdReason"]},"_rank":{"oneof":["rank"]},"_parentTaskId":{"oneof":["parentTaskId"]},"_repo":{"oneof":["repo"]},"_branch":{"oneof":["branch"]},"_ciStatus":{"oneof":["ciStatus"]},"_remoteId":{"oneof":["remoteId"]},"_remoteUrl":{"oneof":["remoteUrl"]},"_reason":{"oneof":["reason"]},"_version":{"oneof":["version"]}},"fields":{"id":{"type":"string","id":1,"options":{"(buf.validate.field).string.min_len":1}},"name":{"type":"string","id":2,"options":{"proto3_optional":true}},"description":{"type":"string","id":3,"options":{"proto3_optional":true}},"acceptanceCriteria":{"type":"string","id":4,"protoName":"acceptance_criteria","options":{"proto3_optional":true}},"stage":{"type":"TaskStage","id":5,"options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}},"priority":{"type":"TaskPriority","id":6,"options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}},"type":{"type":"string","id":7,"options":{"proto3_optional":true}},"assigneeIds":{"rule":"repeated","type":"string","id":10,"protoName":"assignee_ids"},"clearAssignees":{"type":"bool","id":11,"protoName":"clear_assignees"},"dueDate":{"type":"google.protobuf.Timestamp","id":12,"protoName":"due_date"},"clearDueDate":{"type":"bool","id":13,"protoName":"clear_due_date"},"startDate":{"type":"google.protobuf.Timestamp","id":14,"protoName":"start_date"},"clearStartDate":{"type":"bool","id":15,"protoName":"clear_start_date"},"holdReason":{"type":"TaskHoldReason","id":18,"protoName":"hold_reason","options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}},"clearHoldReason":{"type":"bool","id":19,"protoName":"clear_hold_reason"},"parentTaskId":{"type":"string","id":16,"protoName":"parent_task_id","options":{"(buf.validate.field).string.uuid":true,"proto3_optional":true}},"clearParent":{"type":"bool","id":17,"protoName":"clear_parent"},"addLabels":{"rule":"repeated","type":"string","id":20,"protoName":"add_labels"},"removeLabels":{"rule":"repeated","type":"string","id":21,"protoName":"remove_labels"},"addBlocks":{"rule":"repeated","type":"string","id":22,"protoName":"add_blocks"},"addBlockedBy":{"rule":"repeated","type":"string","id":23,"protoName":"add_blocked_by"},"removeRelationships":{"rule":"repeated","type":"string","id":24,"protoName":"remove_relationships"},"rank":{"type":"int64","id":25,"options":{"proto3_optional":true}},"clearRank":{"type":"bool","id":26,"protoName":"clear_rank"},"repo":{"type":"string","id":30,"options":{"proto3_optional":true}},"branch":{"type":"string","id":31,"options":{"proto3_optional":true}},"addPullRequests":{"rule":"repeated","type":"PullRequest","id":32,"protoName":"add_pull_requests"},"ciStatus":{"type":"CIStatus","id":33,"protoName":"ci_status","options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}},"remoteId":{"type":"string","id":34,"protoName":"remote_id","options":{"proto3_optional":true}},"remoteUrl":{"type":"string","id":35,"protoName":"remote_url","options":{"(buf.validate.field).string.uri":true,"proto3_optional":true}},"reason":{"type":"string","id":40,"options":{"proto3_optional":true}},"version":{"type":"string","id":41,"options":{"proto3_optional":true}}}},"ClaimTaskRequest":{"oneofs":{"_stage":{"oneof":["stage"]},"_reason":{"oneof":["reason"]},"_version":{"oneof":["version"]},"_assigneeId":{"oneof":["assigneeId"]}},"fields":{"id":{"type":"string","id":1,"options":{"(buf.validate.field).string.min_len":1}},"stage":{"type":"TaskStage","id":2,"options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}},"reason":{"type":"string","id":3,"options":{"proto3_optional":true}},"version":{"type":"string","id":4,"options":{"proto3_optional":true}},"assigneeId":{"type":"string","id":5,"protoName":"assignee_id","options":{"proto3_optional":true}}}},"ClaimTaskResponse":{"fields":{"task":{"type":"Task","id":1},"claimedAt":{"type":"google.protobuf.Timestamp","id":2,"protoName":"claimed_at"}}},"CloseTaskRequest":{"oneofs":{"_stage":{"oneof":["stage"]},"_reason":{"oneof":["reason"]},"_duplicateOfTaskId":{"oneof":["duplicateOfTaskId"]},"_version":{"oneof":["version"]}},"fields":{"id":{"type":"string","id":1,"options":{"(buf.validate.field).string.min_len":1}},"stage":{"type":"TaskStage","id":2,"options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}},"reason":{"type":"string","id":3,"options":{"proto3_optional":true}},"duplicateOfTaskId":{"type":"string","id":4,"protoName":"duplicate_of_task_id","options":{"(buf.validate.field).string.uuid":true,"proto3_optional":true}},"version":{"type":"string","id":5,"options":{"proto3_optional":true}}}},"DeleteTaskRequest":{"oneofs":{"_reason":{"oneof":["reason"]}},"fields":{"id":{"type":"string","id":1,"options":{"(buf.validate.field).string.min_len":1}},"reason":{"type":"string","id":2,"options":{"proto3_optional":true}}}},"DeleteTaskResponse":{"fields":{}},"AddCommentRequest":{"fields":{"taskId":{"type":"string","id":1,"protoName":"task_id","options":{"(buf.validate.field).string.min_len":1}},"body":{"type":"string","id":2,"options":{"(buf.validate.field).string.min_len":1}}}},"ListCommentsRequest":{"fields":{"taskId":{"type":"string","id":1,"protoName":"task_id","options":{"(buf.validate.field).string.min_len":1}},"pageSize":{"type":"int32","id":2,"protoName":"page_size","options":{"(buf.validate.field).int32.gte":1,"(buf.validate.field).int32.lte":200}},"pageToken":{"type":"string","id":3,"protoName":"page_token"},"order":{"type":"SortOrder","id":4}}},"ListCommentsResponse":{"fields":{"items":{"rule":"repeated","type":"Comment","id":1},"nextPageToken":{"type":"string","id":2,"protoName":"next_page_token"},"hasMore":{"type":"bool","id":3,"protoName":"has_more"},"totalCount":{"type":"int32","id":4,"protoName":"total_count"}}},"GetCommentRequest":{"fields":{"id":{"type":"string","id":1,"options":{"(buf.validate.field).string.uuid":true}}}},"ListCollectionsRequest":{"oneofs":{"_platform":{"oneof":["platform"]}},"fields":{"platform":{"type":"Platform","id":1,"options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}},"pageSize":{"type":"int32","id":2,"protoName":"page_size","options":{"(buf.validate.field).int32.gte":1,"(buf.validate.field).int32.lte":200}},"pageToken":{"type":"string","id":3,"protoName":"page_token"}}},"ListCollectionsResponse":{"fields":{"items":{"rule":"repeated","type":"Collection","id":1},"nextPageToken":{"type":"string","id":2,"protoName":"next_page_token"},"hasMore":{"type":"bool","id":3,"protoName":"has_more"},"totalCount":{"type":"int32","id":4,"protoName":"total_count"}}},"GetCollectionRequest":{"fields":{"id":{"type":"string","id":1,"options":{"(buf.validate.field).string.min_len":1}}}},"CreateCollectionRequest":{"oneofs":{"_description":{"oneof":["description"]},"_platform":{"oneof":["platform"]},"_remoteId":{"oneof":["remoteId"]}},"fields":{"name":{"type":"string","id":1,"options":{"(buf.validate.field).string.min_len":1}},"description":{"type":"string","id":2,"options":{"proto3_optional":true}},"platform":{"type":"Platform","id":3,"options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}},"remoteId":{"type":"string","id":4,"protoName":"remote_id","options":{"proto3_optional":true}}}},"UpdateCollectionRequest":{"oneofs":{"_name":{"oneof":["name"]},"_description":{"oneof":["description"]}},"fields":{"id":{"type":"string","id":1,"options":{"(buf.validate.field).string.uuid":true}},"name":{"type":"string","id":2,"options":{"(buf.validate.field).string.min_len":1,"proto3_optional":true}},"description":{"type":"string","id":3,"options":{"proto3_optional":true}}}},"ExportCollectionRequest":{"fields":{"id":{"type":"string","id":1},"includeChanges":{"type":"bool","id":2}}},"ExportCollectionResponse":{"fields":{"data":{"type":"bytes","id":1},"warnings":{"rule":"repeated","type":"string","id":2}}},"ImportCollectionRequest":{"oneofs":{"_name":{"oneof":["name"]}},"fields":{"data":{"type":"bytes","id":1},"name":{"type":"string","id":2,"options":{"proto3_optional":true}},"dryRun":{"type":"bool","id":3}}},"ImportCollectionResponse":{"fields":{"collectionId":{"type":"string","id":1},"stats":{"type":"ImportStats","id":2},"warnings":{"rule":"repeated","type":"string","id":3}}},"ImportStats":{"fields":{"usersMatched":{"type":"int32","id":1},"usersCreated":{"type":"int32","id":2},"tasks":{"type":"int32","id":3},"comments":{"type":"int32","id":4},"relationships":{"type":"int32","id":5},"changes":{"type":"int32","id":6}}},"GetReadyTasksRequest":{"oneofs":{"_collectionId":{"oneof":["collectionId"]},"_assignee":{"oneof":["assignee"]},"_minPriority":{"oneof":["minPriority"]}},"fields":{"collectionId":{"type":"string","id":1,"protoName":"collection_id","options":{"(buf.validate.field).string.uuid":true,"proto3_optional":true}},"assignee":{"type":"string","id":2,"options":{"proto3_optional":true}},"minPriority":{"type":"TaskPriority","id":3,"protoName":"min_priority","options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}},"includeUnblockedOpen":{"type":"bool","id":4,"protoName":"include_unblocked_open"},"pageSize":{"type":"int32","id":5,"protoName":"page_size","options":{"(buf.validate.field).int32.gte":1,"(buf.validate.field).int32.lte":200}},"pageToken":{"type":"string","id":6,"protoName":"page_token"}}},"ReadyTask":{"fields":{"task":{"type":"Task","id":1},"blockersResolved":{"type":"int32","id":2,"protoName":"blockers_resolved"}}},"GetReadyTasksResponse":{"fields":{"items":{"rule":"repeated","type":"ReadyTask","id":1},"nextPageToken":{"type":"string","id":2,"protoName":"next_page_token"},"hasMore":{"type":"bool","id":3,"protoName":"has_more"},"totalCount":{"type":"int32","id":4,"protoName":"total_count"}}},"GetBlockedTasksRequest":{"oneofs":{"_collectionId":{"oneof":["collectionId"]},"_assignee":{"oneof":["assignee"]}},"fields":{"collectionId":{"type":"string","id":1,"protoName":"collection_id","options":{"(buf.validate.field).string.uuid":true,"proto3_optional":true}},"assignee":{"type":"string","id":2,"options":{"proto3_optional":true}},"pageSize":{"type":"int32","id":3,"protoName":"page_size","options":{"(buf.validate.field).int32.gte":1,"(buf.validate.field).int32.lte":200}},"pageToken":{"type":"string","id":4,"protoName":"page_token"}}},"BlockerInfo":{"fields":{"taskId":{"type":"string","id":1,"protoName":"task_id"},"name":{"type":"string","id":2},"phase":{"type":"TaskPhase","id":3},"stage":{"type":"TaskStage","id":4}}},"BlockedTask":{"fields":{"task":{"type":"Task","id":1},"blockedBy":{"rule":"repeated","type":"BlockerInfo","id":2,"protoName":"blocked_by"}}},"GetBlockedTasksResponse":{"fields":{"items":{"rule":"repeated","type":"BlockedTask","id":1},"nextPageToken":{"type":"string","id":2,"protoName":"next_page_token"},"hasMore":{"type":"bool","id":3,"protoName":"has_more"},"totalCount":{"type":"int32","id":4,"protoName":"total_count"}}},"GetDependencyTreeRequest":{"fields":{"taskId":{"type":"string","id":1,"protoName":"task_id","options":{"(buf.validate.field).string.min_len":1}},"direction":{"type":"DependencyDirection","id":2},"maxDepth":{"type":"int32","id":3,"protoName":"max_depth","options":{"(buf.validate.field).int32.gte":1,"(buf.validate.field).int32.lte":20}}}},"DependencyNode":{"fields":{"task":{"type":"Task","id":1},"blocks":{"rule":"repeated","type":"DependencyNode","id":2},"blockedBy":{"rule":"repeated","type":"DependencyNode","id":3,"protoName":"blocked_by"}}},"GetDependencyTreeResponse":{"fields":{"root":{"type":"DependencyNode","id":1}}},"GetCriticalPathRequest":{"oneofs":{"_rootTaskId":{"oneof":["rootTaskId"]}},"fields":{"collectionId":{"type":"string","id":1,"protoName":"collection_id","options":{"(buf.validate.field).string.uuid":true}},"rootTaskId":{"type":"string","id":2,"protoName":"root_task_id","options":{"(buf.validate.field).string.uuid":true,"proto3_optional":true}}}},"CriticalPathNode":{"fields":{"id":{"type":"string","id":1},"name":{"type":"string","id":2},"stage":{"type":"TaskStage","id":3},"depth":{"type":"int32","id":4}}},"Bottleneck":{"fields":{"id":{"type":"string","id":1},"name":{"type":"string","id":2},"fanOut":{"type":"int32","id":3,"protoName":"fan_out"},"reason":{"type":"string","id":4}}},"GetCriticalPathResponse":{"fields":{"path":{"rule":"repeated","type":"CriticalPathNode","id":1},"totalDepth":{"type":"int32","id":2,"protoName":"total_depth"},"bottleneck":{"type":"Bottleneck","id":3}}},"GetBottlenecksRequest":{"fields":{"collectionId":{"type":"string","id":1,"protoName":"collection_id","options":{"(buf.validate.field).string.uuid":true}},"limit":{"type":"int32","id":2,"options":{"(buf.validate.field).int32.gte":1,"(buf.validate.field).int32.lte":100}}}},"BottleneckTask":{"fields":{"id":{"type":"string","id":1},"name":{"type":"string","id":2},"stage":{"type":"TaskStage","id":3},"downstreamCount":{"type":"int32","id":4,"protoName":"downstream_count"},"directDependents":{"type":"int32","id":5,"protoName":"direct_dependents"}}},"GetBottlenecksResponse":{"fields":{"items":{"rule":"repeated","type":"BottleneckTask","id":1}}},"ListChangesRequest":{"oneofs":{"_field":{"oneof":["field"]}},"fields":{"taskId":{"type":"string","id":1,"protoName":"task_id","options":{"(buf.validate.field).string.min_len":1}},"field":{"type":"string","id":2,"options":{"proto3_optional":true}},"pageSize":{"type":"int32","id":3,"protoName":"page_size","options":{"(buf.validate.field).int32.gte":1,"(buf.validate.field).int32.lte":200}},"pageToken":{"type":"string","id":4,"protoName":"page_token"}}},"ListChangesResponse":{"fields":{"items":{"rule":"repeated","type":"Change","id":1},"nextPageToken":{"type":"string","id":2,"protoName":"next_page_token"},"hasMore":{"type":"bool","id":3,"protoName":"has_more"},"totalCount":{"type":"int32","id":4,"protoName":"total_count"}}},"WhoAmIRequest":{"fields":{}},"ListUsersRequest":{"oneofs":{"_type":{"oneof":["type"]},"_collectionId":{"oneof":["collectionId"]}},"fields":{"type":{"type":"UserType","id":1,"options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}},"collectionId":{"type":"string","id":2,"protoName":"collection_id","options":{"(buf.validate.field).string.uuid":true,"proto3_optional":true}},"pageSize":{"type":"int32","id":3,"protoName":"page_size","options":{"(buf.validate.field).int32.gte":1,"(buf.validate.field).int32.lte":200}},"pageToken":{"type":"string","id":4,"protoName":"page_token"}}},"ListUsersResponse":{"fields":{"items":{"rule":"repeated","type":"User","id":1},"nextPageToken":{"type":"string","id":2,"protoName":"next_page_token"},"hasMore":{"type":"bool","id":3,"protoName":"has_more"},"totalCount":{"type":"int32","id":4,"protoName":"total_count"}}},"GetUserRequest":{"fields":{"id":{"type":"string","id":1,"options":{"(buf.validate.field).string.uuid":true}}}},"GetStatusRequest":{"oneofs":{"_platform":{"oneof":["platform"]}},"fields":{"platform":{"type":"Platform","id":1,"options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}}}},"PlatformConnectionStatus":{"fields":{"platform":{"type":"Platform","id":1},"status":{"type":"string","id":2},"collections":{"type":"int32","id":3}}},"GetStatusResponse":{"fields":{"server":{"type":"string","id":1},"serverVersion":{"type":"string","id":2,"protoName":"server_version"},"apiProtocol":{"type":"string","id":3,"protoName":"api_protocol"},"status":{"type":"string","id":4},"latencyMs":{"type":"int32","id":5,"protoName":"latency_ms"},"authenticatedAs":{"type":"User","id":6,"protoName":"authenticated_as"},"platforms":{"rule":"repeated","type":"PlatformConnectionStatus","id":7},"serverMode":{"type":"string","id":8,"protoName":"server_mode"},"uptimeSeconds":{"type":"int64","id":9,"protoName":"uptime_seconds"},"taskCount":{"type":"int32","id":10,"protoName":"task_count"}}},"GetVersionRequest":{"fields":{}},"GetVersionResponse":{"fields":{"cliVersion":{"type":"string","id":1,"protoName":"cli_version"},"serverVersion":{"type":"string","id":2,"protoName":"server_version"},"apiProtocol":{"type":"string","id":3,"protoName":"api_protocol"},"server":{"type":"string","id":4}}},"WatchTasksRequest":{"oneofs":{"_collectionId":{"oneof":["collectionId"]},"_phase":{"oneof":["phase"]},"_assignee":{"oneof":["assignee"]},"_taskId":{"oneof":["taskId"]},"_priority":{"oneof":["priority"]}},"fields":{"collectionId":{"type":"string","id":1,"protoName":"collection_id","options":{"(buf.validate.field).string.uuid":true,"proto3_optional":true}},"phase":{"type":"TaskPhase","id":2,"options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}},"stages":{"rule":"repeated","type":"TaskStage","id":3},"assignee":{"type":"string","id":4,"options":{"proto3_optional":true}},"labels":{"rule":"repeated","type":"string","id":5},"taskId":{"type":"string","id":6,"protoName":"task_id","options":{"(buf.validate.field).string.uuid":true,"proto3_optional":true}},"includeInitial":{"type":"bool","id":7,"protoName":"include_initial"},"priority":{"type":"TaskPriority","id":8,"options":{"(buf.validate.field).enum.defined_only":true,"proto3_optional":true}}}},"TaskEvent":{"fields":{"eventType":{"type":"TaskEventType","id":1,"protoName":"event_type"},"task":{"type":"Task","id":2},"changes":{"rule":"repeated","type":"Change","id":3},"timestamp":{"type":"google.protobuf.Timestamp","id":4},"sequence":{"type":"int64","id":5}}},"FarmTableService":{"methods":{"ListTasks":{"requestType":"ListTasksRequest","responseType":"ListTasksResponse"},"GetTask":{"requestType":"GetTaskRequest","responseType":"GetTaskResponse"},"CreateTask":{"requestType":"CreateTaskRequest","responseType":"Task"},"UpdateTask":{"requestType":"UpdateTaskRequest","responseType":"Task"},"ClaimTask":{"requestType":"ClaimTaskRequest","responseType":"ClaimTaskResponse"},"CloseTask":{"requestType":"CloseTaskRequest","responseType":"Task"},"DeleteTask":{"requestType":"DeleteTaskRequest","responseType":"DeleteTaskResponse"},"AddComment":{"requestType":"AddCommentRequest","responseType":"Comment"},"ListComments":{"requestType":"ListCommentsRequest","responseType":"ListCommentsResponse"},"GetComment":{"requestType":"GetCommentRequest","responseType":"Comment"},"ListCollections":{"requestType":"ListCollectionsRequest","responseType":"ListCollectionsResponse"},"GetCollection":{"requestType":"GetCollectionRequest","responseType":"Collection"},"CreateCollection":{"requestType":"CreateCollectionRequest","responseType":"Collection"},"UpdateCollection":{"requestType":"UpdateCollectionRequest","responseType":"Collection"},"ExportCollection":{"requestType":"ExportCollectionRequest","responseType":"ExportCollectionResponse"},"ImportCollection":{"requestType":"ImportCollectionRequest","responseType":"ImportCollectionResponse"},"GetReadyTasks":{"requestType":"GetReadyTasksRequest","responseType":"GetReadyTasksResponse"},"GetBlockedTasks":{"requestType":"GetBlockedTasksRequest","responseType":"GetBlockedTasksResponse"},"GetDependencyTree":{"requestType":"GetDependencyTreeRequest","responseType":"GetDependencyTreeResponse"},"GetCriticalPath":{"requestType":"GetCriticalPathRequest","responseType":"GetCriticalPathResponse"},"GetBottlenecks":{"requestType":"GetBottlenecksRequest","responseType":"GetBottlenecksResponse"},"ListChanges":{"requestType":"ListChangesRequest","responseType":"ListChangesResponse"},"WhoAmI":{"requestType":"WhoAmIRequest","responseType":"User"},"ListUsers":{"requestType":"ListUsersRequest","responseType":"ListUsersResponse"},"GetUser":{"requestType":"GetUserRequest","responseType":"User"},"GetStatus":{"requestType":"GetStatusRequest","responseType":"GetStatusResponse"},"GetVersion":{"requestType":"GetVersionRequest","responseType":"GetVersionResponse"},"WatchTasks":{"requestType":"WatchTasksRequest","responseType":"TaskEvent","responseStream":true}}}}}}},"google":{"nested":{"protobuf":{"nested":{"Timestamp":{"fields":{"seconds":{"type":"int64","id":1},"nanos":{"type":"int32","id":2}}},"Struct":{"fields":{"fields":{"keyType":"string","type":"Value","id":1}}},"Value":{"oneofs":{"kind":{"oneof":["nullValue","numberValue","stringValue","boolValue","structValue","listValue"]}},"fields":{"nullValue":{"type":"NullValue","id":1},"numberValue":{"type":"double","id":2},"stringValue":{"type":"string","id":3},"boolValue":{"type":"bool","id":4},"structValue":{"type":"Struct","id":5},"listValue":{"type":"ListValue","id":6}}},"NullValue":{"values":{"NULL_VALUE":0}},"ListValue":{"fields":{"values":{"rule":"repeated","type":"Value","id":1}}}}}}}}'),Sw={nested:Cw},of="farmtable.v1.FarmTableService",Ow="00000000-0000-0000-0000-000000000001",Aw=Tw.Root.fromJSON(Sw);class Iw{constructor(t,i=t.create()){this.type=t,this.value=i}serializeBinary(){const t=this.type.verify(this.value);if(t)throw new Error(`${this.type.fullName}: ${t}`);return this.type.encode(this.value).finish()}toObject(){return this.type.toObject(this.value,{defaults:!1,longs:String,enums:Number})}}function zr(e){const t=Aw.lookupType(`farmtable.v1.${e}`);return class extends Iw{constructor(i){const s=i&&"$type"in i?i:t.create(i??{});super(t,s)}static create(i){return new this(i)}static deserializeBinary(i){return new this(t.decode(i))}}}function $t(e,t,i){return{methodName:e,service:{serviceName:of},requestStream:!1,responseStream:!1,requestType:zr(t),responseType:zr(i)}}function Rw(e,t,i){return{methodName:e,service:{serviceName:of},requestStream:!1,responseStream:!0,requestType:zr(t),responseType:zr(i)}}const yt={listTasks:$t("ListTasks","ListTasksRequest","ListTasksResponse"),getTask:$t("GetTask","GetTaskRequest","GetTaskResponse"),createTask:$t("CreateTask","CreateTaskRequest","Task"),updateTask:$t("UpdateTask","UpdateTaskRequest","Task"),addComment:$t("AddComment","AddCommentRequest","Comment"),listComments:$t("ListComments","ListCommentsRequest","ListCommentsResponse"),listChanges:$t("ListChanges","ListChangesRequest","ListChangesResponse"),listCollections:$t("ListCollections","ListCollectionsRequest","ListCollectionsResponse"),getCollection:$t("GetCollection","GetCollectionRequest","Collection"),createCollection:$t("CreateCollection","CreateCollectionRequest","Collection"),updateCollection:$t("UpdateCollection","UpdateCollectionRequest","Collection"),exportCollection:$t("ExportCollection","ExportCollectionRequest","ExportCollectionResponse"),importCollection:$t("ImportCollection","ImportCollectionRequest","ImportCollectionResponse"),listUsers:$t("ListUsers","ListUsersRequest","ListUsersResponse"),watchTasks:Rw("WatchTasks","WatchTasksRequest","TaskEvent")};class $w{constructor(t={}){this.serverUrl=t.serverUrl??window.location.origin,this.token=t.token??"",this.collectionId=t.collectionId}async listCollections(){const t=await this.unary(yt.listCollections,{pageSize:200});return st(t.items).map(i=>vn(Me(i)))}async getCollection(t){const i=await this.unary(yt.getCollection,{id:t});return vn(i)}async createCollection(t,i){const s=await this.unary(yt.createCollection,{name:t,...i});return vn(s)}async updateCollection(t,i){const s=await this.unary(yt.updateCollection,{id:t,...i});return vn(s)}async exportCollection(t,i=!1){const s=await this.unary(yt.exportCollection,{id:t,includeChanges:i});let r;if(s.data instanceof Uint8Array)r=s.data;else if(typeof s.data=="string"){const n=atob(s.data);r=new Uint8Array(n.length);for(let o=0;o<n.length;o++)r[o]=n.charCodeAt(o)}else r=new Uint8Array;return{data:r,warnings:st(s.warnings).map(Te)}}async importCollection(t,i,s=!1){const r={data:t,dryRun:s};i!==void 0&&(r.name=i);const n=await this.unary(yt.importCollection,r),o=Me(n.stats);return{collectionId:Te(n.collectionId),stats:{usersMatched:Ke(o.usersMatched),usersCreated:Ke(o.usersCreated),tasks:Ke(o.tasks),comments:Ke(o.comments),relationships:Ke(o.relationships),changes:Ke(o.changes)},warnings:st(n.warnings).map(Te)}}async listTasks(){const t=await this.resolveCollectionId(),i=await this.unary(yt.listTasks,{collectionId:t,full:!0,pageSize:200});return st(i.items).map(s=>Sr(Me(s)))}async getTask(t){const i=await this.unary(yt.getTask,{id:t,includeComments:!1,includeChanges:!1,collectionId:await this.resolveCollectionId()});return Sr(Me(i.task))}async createTask(t){const i={name:t.name,collectionId:await this.resolveCollectionId()};t.description!==void 0&&(i.description=t.description),t.stage!==void 0&&(i.stage=t.stage);const s=await this.unary(yt.createTask,i);return Sr(s)}async updateTask(t,i){var n,o,a,c,d,l;const s={id:t};i.name!==void 0&&(s.name=i.name),i.description!==void 0&&(s.description=i.description),i.acceptanceCriteria!==void 0&&(s.acceptanceCriteria=i.acceptanceCriteria),i.stage!==void 0&&(s.stage=i.stage),i.priority!==void 0&&(s.priority=i.priority),i.type!==void 0&&(s.type=i.type),i.dueDate===null?s.clearDueDate=!0:i.dueDate!==void 0&&(s.dueDate=Ph(i.dueDate)),i.startDate===null?s.clearStartDate=!0:i.startDate!==void 0&&(s.startDate=Ph(i.startDate)),i.parentTaskId===null?s.clearParent=!0:i.parentTaskId!==void 0&&(s.parentTaskId=i.parentTaskId),(n=i.addLabels)!=null&&n.length&&(s.addLabels=i.addLabels),(o=i.removeLabels)!=null&&o.length&&(s.removeLabels=i.removeLabels),(a=i.assigneeIds)!=null&&a.length&&(s.assigneeIds=i.assigneeIds),i.clearAssignees&&(s.clearAssignees=!0),(c=i.addBlocks)!=null&&c.length&&(s.addBlocks=i.addBlocks),(d=i.addBlockedBy)!=null&&d.length&&(s.addBlockedBy=i.addBlockedBy),(l=i.removeRelationships)!=null&&l.length&&(s.removeRelationships=i.removeRelationships),i.version!==void 0&&(s.version=i.version);const r=await this.unary(yt.updateTask,s);return Sr(r)}async listUsers(){const t=await this.unary(yt.listUsers,{pageSize:200});return st(t.items).map(i=>Br(Me(i)))}async listComments(t){const i=await this.unary(yt.listComments,{taskId:t,pageSize:200,order:yp.DESC});return st(i.items).map(s=>Lh(Me(s)))}async addComment(t,i){const s=await this.unary(yt.addComment,{taskId:t,body:i});return Lh(s)}async listChanges(t){const i=await this.unary(yt.listChanges,{taskId:t,pageSize:200});return st(i.items).map(s=>af(Me(s)))}async*watchTasks(t){const i=await this.resolveCollectionId(),s=[];let r=null,n=!1,o=null;const a=()=>{r==null||r(),r=null},c=Gs.grpc.invoke(yt.watchTasks,{host:this.serverUrl,request:zr("WatchTasksRequest").create({collectionId:i,includeInitial:!0}),metadata:this.metadata(),onMessage:l=>{s.push(Bw(l.toObject())),a()},onEnd:(l,u)=>{n=!0,l!==Gs.grpc.Code.OK&&l!==Gs.grpc.Code.Canceled&&(o=new ql(l,u||`gRPC stream failed with code ${l}`)),a()}}),d=()=>c.close();t==null||t.addEventListener("abort",d,{once:!0});try{for(;!n||s.length>0;){const l=s.shift();if(l){yield l;continue}if(o)throw o;if(n)break;await new Promise(u=>{r=u})}if(o)throw o}finally{t==null||t.removeEventListener("abort",d),c.close()}}async resolveCollectionId(){if(this.collectionId)return this.collectionId;const t=await this.unary(yt.listCollections,{pageSize:1}),i=st(t.items)[0];return this.collectionId=Te(Me(i).id)||Ow,this.collectionId}unary(t,i){return new Promise((s,r)=>{Gs.grpc.unary(t,{host:this.serverUrl,request:t.requestType.create(i),metadata:this.metadata(),onEnd:n=>{if(n.status!==Gs.grpc.Code.OK){r(new ql(n.status,n.statusMessage||`gRPC request failed with code ${n.status}`));return}if(!n.message){r(new Error(`${t.methodName} returned no response message`));return}s(n.message.toObject())}})})}metadata(){if(this.token)return{Authorization:`Bearer ${this.token}`,"X-Farmtable-Token":this.token}}}function Nh(e={}){const t=window,i=new URLSearchParams(window.location.search),s=t.FARMTABLE_TOKEN??localStorage.getItem("farmtable.token")??"",r=e.readStoredCollectionId===!1?void 0:t.FARMTABLE_COLLECTION_ID??localStorage.getItem("farmtable.collectionId")??void 0,n=i.get("collection")??void 0,o=e.collectionId===null?void 0:e.collectionId??n??r;return new $w({serverUrl:t.FARMTABLE_SERVER_URL??window.location.origin,token:s,collectionId:o})}function Sr(e){return{id:Te(e.id),name:Te(e.name),description:ot(e.description),acceptanceCriteria:ot(e.acceptanceCriteria),phase:Ke(e.phase),stage:Ke(e.stage),nativeStatus:ot(e.nativeStatus),type:ot(e.type),priority:ho(e.priority),assignees:st(e.assignees).map(t=>Br(Me(t))),creator:e.creator?Br(Me(e.creator)):void 0,startDate:ti(e.startDate),dueDate:ti(e.dueDate),collectionId:Te(e.collectionId),parentTaskId:ot(e.parentTaskId),relationships:st(e.relationships).map(t=>Lw(Me(t))),labels:st(e.labels).map(Te),customFields:st(e.customFields).map(t=>Pw(Me(t))),codeContext:e.codeContext?Mw(Me(e.codeContext)):void 0,remoteId:ot(e.remoteId),remoteUrl:ot(e.remoteUrl),remoteData:e.remoteData?Cc(Me(e.remoteData)):void 0,platform:Ke(e.platform),createdAt:ti(e.createdAt)??"",updatedAt:ti(e.updatedAt),closedAt:ti(e.closedAt),version:Te(e.version)}}function vn(e){return{id:Te(e.id),name:Te(e.name),description:ot(e.description),platform:Ke(e.platform),remoteId:ot(e.remoteId),workspaceId:ot(e.workspaceId),linkedAccountId:ot(e.linkedAccountId),statusMappings:st(e.statusMappings).map(t=>Dw(Me(t))),customFieldDefinitions:st(e.customFieldDefinitions).map(t=>Nw(Me(t))),remoteData:e.remoteData?Cc(Me(e.remoteData)):void 0,createdAt:ti(e.createdAt)??"",updatedAt:ti(e.updatedAt)}}function Dw(e){return{nativeStatus:Te(e.nativeStatus),phase:Ke(e.phase),stage:Ke(e.stage)}}function Nw(e){return{fieldId:Te(e.fieldId),fieldName:Te(e.fieldName),fieldType:Ke(e.fieldType),required:!!e.required}}function Br(e){return{id:Te(e.id),name:Te(e.name),email:ot(e.email),type:Ke(e.type),status:Ke(e.status),remoteId:ot(e.remoteId),platform:ho(e.platform)}}function Lw(e){return{type:Ke(e.type),targetTaskId:Te(e.targetTaskId)}}function Pw(e){return{fieldId:Te(e.fieldId),fieldName:Te(e.fieldName),fieldType:Ke(e.fieldType),value:Ur(e.value)}}function Mw(e){return{repo:ot(e.repo),branch:ot(e.branch),pullRequests:st(e.pullRequests).map(t=>Fw(Me(t))),ciStatus:ho(e.ciStatus),commitShas:st(e.commitShas).map(Te)}}function Fw(e){return{id:Te(e.id),url:Te(e.url),status:Ke(e.status)}}function Lh(e){return{id:Te(e.id),taskId:Te(e.taskId),author:Br(Me(e.author)),body:Te(e.body),attachments:st(e.attachments).map(t=>zw(Me(t))),createdAt:ti(e.createdAt)??"",updatedAt:ti(e.updatedAt),remoteId:ot(e.remoteId)}}function zw(e){return{id:Te(e.id),filename:Te(e.filename),url:Te(e.url),contentType:ot(e.contentType),sizeBytes:ho(e.sizeBytes)}}function af(e){return{id:Te(e.id),taskId:Te(e.taskId),field:Te(e.field),oldValue:Ur(e.oldValue),newValue:Ur(e.newValue),changedBy:Br(Me(e.changedBy)),changedAt:ti(e.changedAt)??"",reason:ot(e.reason)}}function Bw(e){return{eventType:Ke(e.eventType),task:e.task?Sr(Me(e.task)):Uw(),changes:st(e.changes).map(t=>af(Me(t))),timestamp:ti(e.timestamp)??"",sequence:BigInt(Te(e.sequence)||"0")}}function Uw(){return{id:"",name:"",phase:0,stage:0,assignees:[],collectionId:"",relationships:[],labels:[],customFields:[],platform:0,createdAt:"",version:""}}function Ph(e){const t=Date.parse(e);if(!Number.isNaN(t))return{seconds:Math.floor(t/1e3),nanos:t%1e3*1e6}}function ti(e){const t=Me(e);if(!t.seconds&&!t.nanos)return;const i=Number(t.seconds??0),s=Number(t.nanos??0);return new Date(i*1e3+Math.floor(s/1e6)).toISOString()}function Cc(e){const t=Me(e.fields);return Object.fromEntries(Object.entries(t).map(([i,s])=>[i,Ur(s)]))}function Ur(e){if(e==null)return null;if(typeof e=="string"||typeof e=="number"||typeof e=="boolean")return e;const t=Me(e);return"nullValue"in t?null:"numberValue"in t?Ke(t.numberValue):"stringValue"in t?Te(t.stringValue):"boolValue"in t?!!t.boolValue:"structValue"in t?Cc(Me(t.structValue)):"listValue"in t?st(Me(t.listValue).values).map(Ur):t}function Me(e){return!e||typeof e!="object"||Array.isArray(e)?{}:e}function st(e){return Array.isArray(e)?e:[]}function Te(e){return typeof e=="string"?e:e==null?"":String(e)}function ot(e){const t=Te(e);return t===""?void 0:t}function Ke(e){return typeof e=="number"?e:Number(e??0)}function ho(e){return e==null?void 0:Ke(e)}var qw=Object.defineProperty,Hw=Object.getOwnPropertyDescriptor,cr=(e,t,i,s)=>{for(var r=s>1?void 0:s?Hw(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&qw(t,i,r),r};const Vw={[ne.UNSPECIFIED]:"Unspecified",[ne.OPEN]:"Open",[ne.IN_PROGRESS]:"In Progress",[ne.ON_HOLD]:"On Hold",[ne.CLOSED]:"Closed"};let os=class extends ye{constructor(){super(...arguments),this.phaseFilter=null,this.assigneeFilter=null,this.users=[],this.filteredCount=0,this.totalCount=0}render(){const e=+(this.phaseFilter!==null)+ +(this.assigneeFilter!==null);return this.hidden=e===0,e===0?Z:T`
      <div class="chips" role="group" aria-label="Active filters">
        ${this.phaseFilter!==null?T`
              <sl-tag
                size="small"
                variant="neutral"
                removable
                @sl-remove=${this.clearPhaseFilter}
              >
                Phase: ${this.phaseLabel(this.phaseFilter)}
              </sl-tag>
            `:Z}
        ${this.assigneeFilter!==null?T`
              <sl-tag
                size="small"
                variant="neutral"
                removable
                @sl-remove=${this.clearAssigneeFilter}
              >
                Assignee: ${this.assigneeLabel(this.assigneeFilter)}
              </sl-tag>
            `:Z}
        <span class="task-count">${this.filteredCount} of ${this.totalCount} tasks</span>
        ${e>=2?T`
              <sl-button size="small" variant="text" @click=${this.clearAllFilters}>
                Clear all
              </sl-button>
            `:Z}
      </div>
    `}phaseLabel(e){return Vw[e]??String(e)}assigneeLabel(e){if(e===rc)return"Unassigned";const t=this.users.find(i=>i.id===e);return(t==null?void 0:t.name)||(t==null?void 0:t.email)||e}clearPhaseFilter(){this.dispatchFilterClear({phase:null,assigneeId:this.assigneeFilter})}clearAssigneeFilter(){this.dispatchFilterClear({phase:this.phaseFilter,assigneeId:null})}clearAllFilters(){this.dispatchFilterClear({phase:null,assigneeId:null})}dispatchFilterClear(e){this.dispatchEvent(new CustomEvent("filter-clear",{detail:e,bubbles:!0,composed:!0}))}};os.styles=ee`
    :host {
      display: block;
      border-bottom: 1px solid var(--sl-color-neutral-200);
      background: var(--sl-color-neutral-0);
    }
    :host([hidden]) {
      display: none !important;
    }
    .chips {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      flex-wrap: wrap;
      padding: 0.5rem 1rem;
    }
    sl-tag {
      cursor: default;
    }
    sl-button::part(base) {
      min-height: var(--sl-input-height-small);
    }
    .task-count {
      margin-left: auto;
      font-size: 0.8rem;
      color: var(--sl-color-neutral-500);
      white-space: nowrap;
    }
  `;cr([k({attribute:!1})],os.prototype,"phaseFilter",2);cr([k({attribute:!1})],os.prototype,"assigneeFilter",2);cr([k({attribute:!1})],os.prototype,"users",2);cr([k({attribute:!1})],os.prototype,"filteredCount",2);cr([k({attribute:!1})],os.prototype,"totalCount",2);os=cr([Oe("ft-filter-chips")],os);var jw=Object.defineProperty,Gw=Object.getOwnPropertyDescriptor,lf=(e,t,i,s)=>{for(var r=s>1?void 0:s?Gw(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&jw(t,i,r),r};let qn=class extends ye{connectedCallback(){super.connectedCallback(),new Is(this,this.store)}computePhaseStats(e){const t={[ne.OPEN]:0,[ne.IN_PROGRESS]:0,[ne.ON_HOLD]:0,[ne.CLOSED]:0};for(const i of e)t[i.phase]!==void 0&&t[i.phase]++;return[{label:"Open",count:t[ne.OPEN]},{label:"In Progress",count:t[ne.IN_PROGRESS]},{label:"On Hold",count:t[ne.ON_HOLD]},{label:"Closed",count:t[ne.CLOSED]}]}computeReadyCount(e){return e.filter(t=>no(t,this.store)).length}navigateToReadyQueue(){this.dispatchEvent(new CustomEvent("view-change",{detail:{view:"ready-queue"},bubbles:!0,composed:!0}))}computePriorityStats(e){const t={[Q.URGENT]:0,[Q.HIGH]:0,[Q.NORMAL]:0,[Q.LOW]:0,[Q.UNSPECIFIED]:0};for(const s of e){const r=s.priority??Q.UNSPECIFIED;t[r]!==void 0&&t[r]++}return[Q.URGENT,Q.HIGH,Q.NORMAL,Q.LOW,Q.UNSPECIFIED].map(s=>({priority:s,label:Pn[s]??"Unknown",variant:oc[s]??"neutral",count:t[s]}))}render(){const e=this.store.allTasks;if(e.length===0)return T`
        <ft-empty-state
          icon="bar-chart"
          heading="No tasks yet"
          subtitle="Create tasks to see dashboard statistics"
        ></ft-empty-state>
      `;const t=this.computePhaseStats(e),i=this.computePriorityStats(e),s=t.reduce((n,o)=>n+o.count,0),r=this.computeReadyCount(e);return T`
      <div class="dashboard">
        <h2 class="section-title">Tasks by Phase</h2>
        <div class="stat-cards">
          ${t.map(n=>T`
              <div class="stat-card" role="group" aria-label="${n.label}: ${n.count}">
                <div class="stat-count">${n.count}</div>
                <div class="stat-label">${n.label}</div>
              </div>
            `)}
          <div
            class="stat-card ready"
            role="link"
            tabindex="0"
            aria-label="Available: ${r} — click to view Available Queue"
            title="View Available Queue"
            @click=${this.navigateToReadyQueue}
            @keydown=${n=>{(n.key==="Enter"||n.key===" ")&&(n.preventDefault(),this.navigateToReadyQueue())}}
          >
            <div class="stat-count">${r}</div>
            <div class="stat-label">Available</div>
          </div>
          <div class="stat-card total" role="group" aria-label="Total: ${s}">
            <div class="stat-count">${s}</div>
            <div class="stat-label">Total</div>
          </div>
        </div>

        <h2 class="section-title">Tasks by Priority</h2>
        <div class="priority-badges">
          ${i.map(n=>T`
              <div class="priority-item">
                <sl-badge variant=${n.variant} pill>${n.label}</sl-badge>
                <span class="priority-count">${n.count}</span>
              </div>
            `)}
        </div>
      </div>
    `}};qn.styles=ee`
    :host {
      display: block;
      height: 100%;
    }

    .dashboard {
      max-width: 900px;
      margin: 0 auto;
      padding: 1rem 0;
    }

    .section-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--sl-color-neutral-500);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin: 0 0 0.75rem;
    }

    .stat-cards {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 1.5rem;
    }

    .stat-card {
      flex: 1;
      min-width: 120px;
      border: 1px solid var(--sl-color-neutral-200);
      border-radius: var(--sl-border-radius-medium);
      padding: 1rem 1.25rem;
      background: var(--sl-color-neutral-0);
      text-align: center;
    }

    .stat-card.total {
      border-color: var(--sl-color-primary-300);
      background: var(--sl-color-primary-50);
    }

    .stat-card.ready {
      border-color: var(--sl-color-success-300);
      background: var(--sl-color-success-50);
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    }

    .stat-card.ready:hover {
      border-color: var(--sl-color-success-500);
      box-shadow: 0 0 0 1px var(--sl-color-success-500);
    }

    .stat-card.ready .stat-count {
      color: var(--sl-color-success-700);
    }

    .stat-card.ready .stat-label {
      color: var(--sl-color-success-600);
    }

    .stat-count {
      font-size: 2rem;
      font-weight: 700;
      line-height: 1.2;
      color: var(--sl-color-neutral-900);
    }

    .stat-card.total .stat-count {
      color: var(--sl-color-primary-700);
    }

    .stat-label {
      font-size: 0.8rem;
      color: var(--sl-color-neutral-500);
      margin-top: 0.25rem;
    }

    .priority-badges {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      align-items: center;
    }

    .priority-item {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .priority-count {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--sl-color-neutral-600);
    }
  `;lf([k({attribute:!1})],qn.prototype,"store",2);qn=lf([Oe("ft-dashboard-view")],qn);var Ww=Object.defineProperty,Yw=Object.getOwnPropertyDescriptor,hi=(e,t,i,s)=>{for(var r=s>1?void 0:s?Yw(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&Ww(t,i,r),r};const xr=220,yn=80,Kw=50,Xw=500,Jw=300;function _l(e,t){const i=e.x+e.width/2,s=e.y,r=t.x-t.width/2,n=t.y,o=r-i,a=i+o*.4,c=r-o*.4;return`M ${i} ${s} C ${a} ${s}, ${c} ${n}, ${r} ${n}`}function Zw(e,t,i){const s=new Set,r=(n,o)=>{const a=new Set,c=[n];for(;c.length>0;){const d=c.shift();if(a.has(d)||!i.has(d))continue;const l=t.getTask(d);if(!(!l||l.phase===ne.CLOSED&&d!==e)){a.add(d),s.add(d);for(const u of l.relationships)u.type===o&&!a.has(u.targetTaskId)&&c.push(u.targetTaskId)}}};return r(e,fe.BLOCKED_BY),r(e,fe.BLOCKS),s}function Qw(e,t,i){const s=new Map,r=new Set(e.map(a=>a.id)),n=new Set;function o(a){if(s.has(a))return s.get(a);if(n.has(a))return console.warn(`[ft-dependency-view] Cycle detected involving task ${a}; placing at layer 0`),s.set(a,0),0;const c=t.getTask(a);if(!c||!r.has(a))return s.set(a,0),0;n.add(a);let d=-1;for(const p of c.relationships){if(p.type!==fe.BLOCKED_BY)continue;const h=t.getTask(p.targetTaskId);if(!h||h.phase===ne.CLOSED&&!(i!=null&&i.has(p.targetTaskId))||!r.has(p.targetTaskId))continue;const g=o(p.targetTaskId);g>d&&(d=g)}n.delete(a);const l=d>=0?d+1:0,u=Math.min(l,Kw);return s.set(a,u),u}for(const a of e)o(a.id);return s}let Ue=class extends ye{constructor(){super(...arguments),this.selectedTaskId=null,this.readOnly=!1,this.isolateMode=!1,this.panX=0,this.panY=0,this.scale=1,this.isPanning=!1,this.draggingNodeId=null,this.dragOverNodeId=null,this.containerWidth=800,this.containerHeight=600,this.panStartX=0,this.panStartY=0,this.panStartViewX=0,this.panStartViewY=0,this.layoutNodes=[],this.layoutEdges=[],this.nodeMap=new Map,this.lastStructureKey="",this.needsCenter=!0,this.animationFrameId=null,this._dragEnterCounters=new Map,this.dndAnimContext=null,this.nodeAnimTargets=null,this.nodeAnimStarts=null,this.nodeAnimFrameId=null,this.animatingEdge=null,this.animatingEdgeProgress=0,this.edgeAnimFrameId=null,this.boundOnWheel=this.onWheel.bind(this),this.wheelListenerAttached=!1,this.handleMouseMove=e=>{if(!this.isPanning)return;const t=(e.clientX-this.panStartX)/this.scale,i=(e.clientY-this.panStartY)/this.scale;this.panX=this.panStartViewX-t,this.panY=this.panStartViewY-i},this.handleMouseUp=()=>{this.isPanning=!1},this._upstreamIds=null,this._downstreamIds=null,this._edgeCacheKey=null}connectedCallback(){super.connectedCallback(),this.storeCtrl=new Is(this,this.store),window.addEventListener("mousemove",this.handleMouseMove),window.addEventListener("mouseup",this.handleMouseUp)}disconnectedCallback(){var t;const e=this.renderRoot.querySelector("svg");e==null||e.removeEventListener("wheel",this.boundOnWheel),this.wheelListenerAttached=!1,super.disconnectedCallback(),window.removeEventListener("mousemove",this.handleMouseMove),window.removeEventListener("mouseup",this.handleMouseUp),(t=this.resizeObserver)==null||t.disconnect(),this.cancelPanAnimation(),this.cancelAllDndAnimations()}firstUpdated(){const e=this.renderRoot.querySelector(".canvas-container");if(e){const t=e.getBoundingClientRect();t.width>0&&(this.containerWidth=t.width),t.height>0&&(this.containerHeight=t.height),this.resizeObserver=new ResizeObserver(i=>{for(const s of i){const r=s.contentRect.width,n=s.contentRect.height;r>0&&(this.containerWidth=r),n>0&&(this.containerHeight=n),this.requestUpdate()}}),this.resizeObserver.observe(e)}this.layoutNodes.length>0&&this.needsCenter&&(this.centerGraph(),this.needsCenter=!1)}willUpdate(e){super.willUpdate(e),e.size>0&&[...e.keys()].every(i=>Ue.PAN_ZOOM_KEYS.has(i))||(this.runLayout(),this.computeEdgeSets())}updated(e){if(!this.wheelListenerAttached){const t=this.renderRoot.querySelector("svg");t&&(t.addEventListener("wheel",this.boundOnWheel,{passive:!1}),this.wheelListenerAttached=!0)}if(e.has("selectedTaskId")&&this.selectedTaskId)this.centerOnNode(this.selectedTaskId),this.needsCenter=!1;else if(this.needsCenter&&this.layoutNodes.length>0&&this.nodeAnimFrameId===null&&this.edgeAnimFrameId===null){const t=this.renderRoot.querySelector(".canvas-container");if(t){const i=t.getBoundingClientRect();i.width>0&&(this.containerWidth=i.width,this.containerHeight=i.height,this.centerGraph(),this.needsCenter=!1)}}}static easeInOut(e){return e<.5?2*e*e:1-Math.pow(-2*e+2,2)/2}cancelPanAnimation(){this.animationFrameId!==null&&(cancelAnimationFrame(this.animationFrameId),this.animationFrameId=null)}cancelNodeAnimation(){if(this.nodeAnimFrameId!==null&&(cancelAnimationFrame(this.nodeAnimFrameId),this.nodeAnimFrameId=null),this.nodeAnimTargets){for(const e of this.layoutNodes){const t=this.nodeAnimTargets.get(e.id);t&&(e.x=t.x,e.y=t.y)}this.nodeAnimTargets=null,this.nodeAnimStarts=null,this.requestUpdate()}}cancelEdgeAnimation(){this.edgeAnimFrameId!==null&&(cancelAnimationFrame(this.edgeAnimFrameId),this.edgeAnimFrameId=null),this.animatingEdge=null,this.animatingEdgeProgress=0}cancelAllDndAnimations(){this.cancelNodeAnimation(),this.cancelEdgeAnimation(),this.dndAnimContext=null}centerOnNode(e){const t=this.layoutNodes.find(a=>a.id===e);if(!t)return;const i=Math.min(3,Math.max(.3,Ue.TARGET_NODE_VIEWPORT_FRACTION*this.containerWidth/xr)),s=this.containerWidth/i,r=this.containerHeight/i,n=t.x-s/2,o=t.y-r/2;this.animatePanZoomTo(n,o,i,t.x,t.y)}animatePanZoomTo(e,t,i,s,r){this.cancelPanAnimation();const n=this.panX,o=this.panY,a=this.scale,c=n+this.containerWidth/a/2,d=o+this.containerHeight/a/2,l=Ue.PAN_DURATION_MS;let u=null;const p=h=>{u===null&&(u=h);const g=h-u,f=Math.min(g/l,1),m=Ue.easeInOut(f),b=a+(i-a)*m,v=c+(s-c)*m,y=d+(r-d)*m,w=this.containerWidth/b,C=this.containerHeight/b;this.scale=b,this.panX=v-w/2,this.panY=y-C/2,f<1?this.animationFrameId=requestAnimationFrame(p):(this.scale=i,this.panX=e,this.panY=t,this.animationFrameId=null)};this.animationFrameId=requestAnimationFrame(p)}getVisibleTasks(){const e=new Set;for(const s of this.store.allTasks)if(s.phase!==ne.CLOSED){for(const r of s.relationships){if(r.type===fe.BLOCKED_BY){const n=this.store.getTask(r.targetTaskId);n&&n.phase!==ne.CLOSED&&(e.add(s.id),e.add(r.targetTaskId))}if(r.type===fe.BLOCKS){const n=this.store.getTask(r.targetTaskId);n&&n.phase!==ne.CLOSED&&(e.add(s.id),e.add(r.targetTaskId))}}no(s,this.store)&&e.add(s.id)}if(this.isolateMode&&this.selectedTaskId){const s=this.store.getTask(this.selectedTaskId);if(s&&s.phase===ne.CLOSED){e.add(s.id);for(const r of s.relationships)(r.type===fe.BLOCKS||r.type===fe.BLOCKED_BY)&&this.store.getTask(r.targetTaskId)&&e.add(r.targetTaskId)}}const t=s=>this.isolateMode&&this.selectedTaskId===s.id;let i=this.store.allTasks.filter(s=>e.has(s.id)&&(s.phase!==ne.CLOSED||t(s)));if(this.isolateMode&&this.selectedTaskId){const s=Zw(this.selectedTaskId,this.store,e);i=i.filter(r=>s.has(r.id))}return i}structureKey(e){const t=this.isolateMode?`iso:${this.selectedTaskId??""}`:"";return e.map(i=>`${i.id}:${i.phase}:${i.relationships.map(s=>`${s.type}-${s.targetTaskId}`).sort().join(",")}`).sort().join("|")+"||"+t}runLayout(){const e=this.getVisibleTasks(),t=this.structureKey(e);if(t===this.lastStructureKey&&this.layoutNodes.length>0){const u=new Map(e.map(p=>[p.id,p]));for(const p of this.layoutNodes){const h=u.get(p.id);h&&(p.task=h)}return}this.lastStructureKey=t;const i=this.dndAnimContext;this.dndAnimContext=null,i||(this.needsCenter=!0,(this.nodeAnimFrameId!==null||this.edgeAnimFrameId!==null)&&this.cancelAllDndAnimations());const s=this.isolateMode&&this.selectedTaskId?(()=>{const u=this.store.getTask(this.selectedTaskId);return u&&u.phase===ne.CLOSED?new Set([this.selectedTaskId]):void 0})():void 0,r=Qw(e,this.store,s),n=new Set(e.map(u=>u.id)),o=new Map;for(const u of e){const p=r.get(u.id)??0;let h=o.get(p);h||(h=[],o.set(p,h)),h.push(u)}const{LAYER_GAP:a,NODE_GAP:c,MARGIN_LEFT:d,MARGIN_TOP:l}=Ue;this.layoutNodes=[];for(const[u,p]of o){const h=d+xr/2+u*(xr+a);for(let g=0;g<p.length;g++){const f=l+yn/2+g*(yn+c);this.layoutNodes.push({id:p[g].id,x:h,y:f,width:xr,height:yn,task:p[g]})}}this.nodeMap=new Map(this.layoutNodes.map(u=>[u.id,u])),this.layoutEdges=[];for(const u of e)for(const p of u.relationships){if(p.type!==fe.BLOCKED_BY||!n.has(p.targetTaskId))continue;const h=this.store.getTask(p.targetTaskId);!h||h.phase===ne.CLOSED&&!(s!=null&&s.has(p.targetTaskId))||this.nodeMap.has(p.targetTaskId)&&this.nodeMap.has(u.id)&&this.layoutEdges.push({from:p.targetTaskId,to:u.id})}i&&this.startDndAnimation(i)}startDndAnimation(e){const t=this.layoutEdges.find(l=>l.from===e.targetId&&l.to===e.sourceId);t&&(this.animatingEdge={from:t.from,to:t.to},this.animatingEdgeProgress=0);const i=this.nodeMap.get(e.targetId),s=e.beforePositions.get(e.targetId);let r=0,n=0;i&&s&&(r=i.x-s.x,n=i.y-s.y,this.panX+=r,this.panY+=n);const o=new Map,a=new Map;for(const l of this.layoutNodes){o.set(l.id,{x:l.x,y:l.y});const u=e.beforePositions.get(l.id);if(u){const p=u.x+r,h=u.y+n;a.set(l.id,{x:p,y:h}),l.x=p,l.y=h}}this.nodeAnimTargets=o,this.nodeAnimStarts=a;let c=null;const d=l=>{var g,f,m;c===null&&(c=l);const u=l-c,p=Math.min(u/Xw,1),h=Ue.easeInOut(p);for(const b of this.layoutNodes){const v=(g=this.nodeAnimStarts)==null?void 0:g.get(b.id),y=(f=this.nodeAnimTargets)==null?void 0:f.get(b.id);v&&y&&(b.x=v.x+(y.x-v.x)*h,b.y=v.y+(y.y-v.y)*h)}if(this.requestUpdate(),p<1)this.nodeAnimFrameId=requestAnimationFrame(d);else{for(const b of this.layoutNodes){const v=(m=this.nodeAnimTargets)==null?void 0:m.get(b.id);v&&(b.x=v.x,b.y=v.y)}this.nodeAnimFrameId=null,this.nodeAnimTargets=null,this.nodeAnimStarts=null,this.requestUpdate(),this.animatingEdge&&this.startEdgeDrawIn()}};this.nodeAnimFrameId=requestAnimationFrame(d)}startEdgeDrawIn(){let e=null;const t=i=>{e===null&&(e=i);const s=i-e,r=Math.min(s/Jw,1);this.animatingEdgeProgress=Ue.easeInOut(r),this.requestUpdate(),r<1?this.edgeAnimFrameId=requestAnimationFrame(t):(this.animatingEdge=null,this.animatingEdgeProgress=0,this.edgeAnimFrameId=null,this.requestUpdate())};this.edgeAnimFrameId=requestAnimationFrame(t)}renderAnimatingEdge(){if(!this.animatingEdge)return null;const e=this.nodeMap.get(this.animatingEdge.from),t=this.nodeMap.get(this.animatingEdge.to);if(!e||!t)return null;const i=_l(e,t),s=e.x+e.width/2,r=t.x-t.width/2,n=e.y,o=t.y,a=r-s,c=o-n,d=Math.sqrt(a*a+c*c)*1.2,l=d*this.animatingEdgeProgress,u=d-l;return Ji`<path
      d="${i}"
      class="edge-dependency-drawing"
      stroke-dasharray="${d}"
      stroke-dashoffset="${u}"
    />`}centerGraph(){if(this.cancelPanAnimation(),this.layoutNodes.length===0)return;const e=40;let t=1/0,i=-1/0,s=1/0,r=-1/0;for(const h of this.layoutNodes){const g=h.x-h.width/2,f=h.x+h.width/2,m=h.y-h.height/2,b=h.y+h.height/2;g<t&&(t=g),f>i&&(i=f),m<s&&(s=m),b>r&&(r=b)}t-=e,s-=e,i+=e,r+=e;const n=i-t,o=r-s,a=this.containerWidth/n,c=this.containerHeight/o;this.scale=Math.min(a,c,2),this.scale=Math.max(.3,this.scale);const d=this.containerWidth/this.scale,l=this.containerHeight/this.scale,u=(t+i)/2,p=(s+r)/2;this.panX=u-d/2,this.panY=p-l/2}onMouseDown(e){if(e.button!==0)return;const t=e.target;t.closest("ft-tree-node")||t.closest("foreignObject")||(this.cancelPanAnimation(),this.cancelAllDndAnimations(),this.isPanning=!0,this.panStartX=e.clientX,this.panStartY=e.clientY,this.panStartViewX=this.panX,this.panStartViewY=this.panY,e.preventDefault())}onWheel(e){e.preventDefault(),this.cancelPanAnimation(),this.cancelAllDndAnimations();const t=e.deltaY>0?.9:1.1,i=Math.min(3,Math.max(.3,this.scale*t)),s=e.currentTarget.getBoundingClientRect(),r=e.clientX-s.left,n=e.clientY-s.top,o=this.panX+r/this.scale,a=this.panY+n/this.scale;this.panX=o-r/i,this.panY=a-n/i,this.scale=i}onNodeClick(e){this.dispatchEvent(new CustomEvent("task-select",{detail:{taskId:e},bubbles:!0,composed:!0}))}onIsolateToggle(){this.dispatchEvent(new CustomEvent("isolate-toggle",{detail:{isolateMode:!this.isolateMode},bubbles:!0,composed:!0}))}computeEdgeSets(){const e=`${this.selectedTaskId}::${this.lastStructureKey}`;if(this._edgeCacheKey===e)return;if(this._edgeCacheKey=e,!this.selectedTaskId){this._upstreamIds=null,this._downstreamIds=null;return}const t=new Set,i=[this.selectedTaskId];for(;i.length>0;){const n=i.shift();if(t.has(n))continue;t.add(n);const o=this.store.getTask(n);if(o)for(const a of o.relationships)a.type===fe.BLOCKED_BY&&!t.has(a.targetTaskId)&&i.push(a.targetTaskId)}t.delete(this.selectedTaskId);const s=new Set,r=[this.selectedTaskId];for(;r.length>0;){const n=r.shift();if(s.has(n))continue;s.add(n);const o=this.store.getTask(n);if(o)for(const a of o.relationships)a.type===fe.BLOCKS&&!s.has(a.targetTaskId)&&r.push(a.targetTaskId)}s.delete(this.selectedTaskId),this._upstreamIds=t,this._downstreamIds=s}classifyEdge(e,t){if(!this.selectedTaskId||!this._upstreamIds||!this._downstreamIds)return null;const i=this.selectedTaskId,s=e===i||this._upstreamIds.has(e),r=t===i||this._upstreamIds.has(t);if(s&&r)return"blocking";const n=e===i||this._downstreamIds.has(e),o=t===i||this._downstreamIds.has(t);return n&&o?"blocked":null}onNodeDragStart(e,t){this.readOnly||(t.dataTransfer.setData("application/ft-task-id",e),t.dataTransfer.effectAllowed="link",this.draggingNodeId=e)}onNodeDragEnd(){this.draggingNodeId=null,this.dragOverNodeId=null,this._dragEnterCounters.clear()}onNodeDragOver(e){this.readOnly||(e.preventDefault(),e.dataTransfer.dropEffect="link")}onNodeDragEnter(e){if(this.readOnly)return;const t=(this._dragEnterCounters.get(e)??0)+1;this._dragEnterCounters.set(e,t),this.dragOverNodeId=e}onNodeDragLeave(e){if(this.readOnly)return;const t=(this._dragEnterCounters.get(e)??0)-1;this._dragEnterCounters.set(e,Math.max(0,t)),t<=0&&(this._dragEnterCounters.delete(e),this.dragOverNodeId===e&&(this.dragOverNodeId=null))}onNodeDrop(e,t){if(this.readOnly)return;t.preventDefault(),this._dragEnterCounters.clear(),this.dragOverNodeId=null,this.draggingNodeId=null;const i=t.dataTransfer.getData("application/ft-task-id");if(!i||i===e)return;const s=this.store.getTask(i);if(s&&s.relationships.some(o=>o.type===fe.BLOCKED_BY&&o.targetTaskId===e))return;if(this.wouldCreateCycle(i,e)){this.showCycleWarning();return}this.cancelAllDndAnimations();const r=new Map;for(const n of this.layoutNodes)r.set(n.id,{x:n.x,y:n.y});this.dndAnimContext={sourceId:i,targetId:e,beforePositions:r},this.dispatchEvent(new CustomEvent("dependency-drop",{detail:{sourceTaskId:i,targetTaskId:e},bubbles:!0,composed:!0}))}wouldCreateCycle(e,t){const i=new Set,s=[e];for(;s.length>0;){const r=s.pop();if(r===t)return!0;if(i.has(r))continue;i.add(r);const n=this.store.getTask(r);if(n)for(const o of n.relationships)o.type===fe.BLOCKS&&!i.has(o.targetTaskId)&&s.push(o.targetTaskId)}return!1}showCycleWarning(){const e=Object.assign(document.createElement("sl-alert"),{variant:"warning",closable:!0,duration:5e3}),t=document.createElement("sl-icon");t.slot="icon",t.setAttribute("name","exclamation-triangle"),e.append(t,document.createTextNode("Cannot add dependency: would create a circular dependency")),document.body.appendChild(e),e.toast()}onMinimapPan(e){this.cancelPanAnimation(),this.cancelAllDndAnimations(),this.panX=e.detail.panX,this.panY=e.detail.panY}onMinimapWheel(e){this.cancelPanAnimation(),this.cancelAllDndAnimations();const t=e.detail.deltaY>0?.9:1.1,i=Math.min(3,Math.max(.3,this.scale*t)),s=this.containerWidth/this.scale,r=this.containerHeight/this.scale,n=this.panX+s/2,o=this.panY+r/2;this.panX=n-this.containerWidth/i/2,this.panY=o-this.containerHeight/i/2,this.scale=i}render(){if(this.store.taskCount===0)return T`<ft-empty-state
        icon="diagram-3"
        heading="No tasks to display"
        subtitle="Tasks will appear here when added to this collection"
      ></ft-empty-state>`;if(this.layoutNodes.length===0)return T`<ft-empty-state
        icon="diagram-3"
        heading="No dependency relationships"
        subtitle="Tasks with blocking relationships will appear here"
      ></ft-empty-state>`;const e=this.containerWidth/this.scale,t=this.containerHeight/this.scale,i=Math.max(xr,yn),s=this.panX-i,r=this.panX+e+i,n=this.panY-i,o=this.panY+t+i,a=this.layoutNodes.filter(l=>l.x+l.width/2>s&&l.x-l.width/2<r&&l.y+l.height/2>n&&l.y-l.height/2<o),c=new Set(a.map(l=>l.id)),d=this.layoutEdges.filter(l=>c.has(l.from)||c.has(l.to));return T`
      <div class="toolbar">
        <sl-tooltip content=${this.isolateMode?"Show full graph":"Solo selected task and its connected dependencies"}>
          <button
            class="isolate-btn ${this.isolateMode?"active":""}"
            ?disabled=${!this.selectedTaskId}
            @click=${this.onIsolateToggle}
          >
            <sl-icon name=${this.isolateMode?"fullscreen-exit":"funnel"}></sl-icon>
            Solo
          </button>
        </sl-tooltip>
      </div>

      <div class="canvas-container">
        <svg
          class=${this.isPanning?"panning":""}
          viewBox="${this.panX} ${this.panY} ${e} ${t}"
          @mousedown=${this.onMouseDown}
        >
          <g class="edges">
            ${d.map(l=>{if(this.animatingEdge&&l.from===this.animatingEdge.from&&l.to===this.animatingEdge.to)return null;const u=this.nodeMap.get(l.from),p=this.nodeMap.get(l.to);if(!u||!p)return null;const h=this.classifyEdge(l.from,l.to);if(this.isolateMode&&h===null)return null;const g=h==="blocking"?"edge-dependency edge-blocking":h==="blocked"?"edge-dependency edge-blocked":"edge-dependency";return Ji`<path
                d="${_l(u,p)}"
                class="${g}"
              />`})}
            ${this.renderAnimatingEdge()}
          </g>
          <g class="nodes">
            ${a.map(l=>{const u=this.dragOverNodeId===l.id&&this.draggingNodeId!==l.id,p=this.draggingNodeId===l.id,h=this.selectedTaskId===l.id;return Ji`
                ${u?Ji`<rect
                      x="${l.x-l.width/2-4}"
                      y="${l.y-l.height/2-4}"
                      width="${l.width+8}"
                      height="${l.height+8}"
                      rx="10"
                      fill="rgba(59, 130, 246, 0.08)"
                      stroke="var(--sl-color-primary-400, #818cf8)"
                      stroke-width="2"
                      stroke-dasharray="6 3"
                      class="drop-highlight"
                    />`:null}
                <foreignObject
                  x="${l.x-l.width/2}"
                  y="${l.y-l.height/2}"
                  width="${l.width}"
                  height="${l.height}"
                  data-task-id="${l.id}"
                  overflow="${h?"visible":"hidden"}"
                  style="${p?"opacity: 0.4":""}"
                  @click=${()=>this.onNodeClick(l.id)}
                  @dragstart=${g=>this.onNodeDragStart(l.id,g)}
                  @dragend=${()=>this.onNodeDragEnd()}
                  @dragover=${g=>this.onNodeDragOver(g)}
                  @dragenter=${()=>this.onNodeDragEnter(l.id)}
                  @dragleave=${()=>this.onNodeDragLeave(l.id)}
                  @drop=${g=>this.onNodeDrop(l.id,g)}
                >
                  <ft-tree-node
                    .task=${l.task}
                    ?selected=${this.selectedTaskId===l.id}
                    ?readOnly=${this.readOnly}
                    .childCount=${0}
                  ></ft-tree-node>
                </foreignObject>
              `})}
          </g>
        </svg>
        <!-- Minimap receives the FULL layout data (all nodes/edges),
             NOT the viewport-culled subset, so it always shows the
             complete graph overview regardless of pan/zoom position. -->
        <ft-minimap
          .nodes=${this.layoutNodes}
          .edges=${this.layoutEdges}
          .panX=${this.panX}
          .panY=${this.panY}
          .scale=${this.scale}
          .containerWidth=${this.containerWidth}
          .containerHeight=${this.containerHeight}
          .edgePathFn=${_l}
          @minimap-pan=${this.onMinimapPan}
          @minimap-wheel=${this.onMinimapWheel}
        ></ft-minimap>
      </div>
    `}};Ue.styles=ee`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .canvas-container {
      flex: 1;
      min-height: 0;
      position: relative;
      overflow: hidden;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      cursor: grab;
    }
    svg.panning {
      cursor: grabbing;
    }
    .edge-dependency {
      stroke: var(--sl-color-primary-500, #6366f1);
      stroke-width: 1.5;
      fill: none;
      stroke-dasharray: 6 3;
    }
    /* Colorblind-accessible edge colors when a node is selected.
       "blocking" = edge TO a node that blocks the selection (upstream).
       "blocked"  = edge TO a node that is blocked by the selection
       (downstream).
       #D55E00 (vermillion) is from the Okabe-Ito palette.
       #7B3FF2 (blue-purple) is a custom colorblind-accessible color,
       NOT from the Okabe-Ito palette. */
    .edge-blocking {
      stroke: #D55E00;
      stroke-width: 2.5;
      stroke-dasharray: none;
    }
    .edge-blocked {
      stroke: #7B3FF2;
      stroke-width: 2.5;
      stroke-dasharray: none;
    }
    .edge-dependency-drawing {
      stroke: var(--sl-color-primary-500, #6366f1);
      stroke-width: 2;
      fill: none;
    }
    .drop-highlight {
      pointer-events: none;
    }
    foreignObject {
      transition: opacity 0.15s;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      background: var(--sl-color-neutral-50, #1e1e2e);
      border-bottom: 1px solid var(--sl-color-neutral-200, #334155);
      font-family: var(--sl-font-sans, sans-serif);
      flex-shrink: 0;
    }
    .isolate-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.25rem 0.6rem;
      border: 1px solid var(--sl-color-neutral-300, #475569);
      border-radius: var(--sl-border-radius-medium, 4px);
      background: var(--sl-color-neutral-0, #fff);
      color: var(--sl-color-neutral-700, #cbd5e1);
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
      font-family: inherit;
      line-height: 1.4;
    }
    .isolate-btn:hover {
      background: var(--sl-color-neutral-100, #334155);
      border-color: var(--sl-color-neutral-400, #64748b);
    }
    .isolate-btn.active {
      background: var(--sl-color-primary-100, #312e81);
      border-color: var(--sl-color-primary-500, #6366f1);
      color: var(--sl-color-primary-700, #a5b4fc);
    }
    .isolate-btn.active:hover {
      background: var(--sl-color-primary-200, #3730a3);
    }
    .isolate-btn sl-icon {
      font-size: 0.9rem;
    }
    .isolate-btn[disabled] {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `;Ue.PAN_ZOOM_KEYS=new Set(["panX","panY","scale","isPanning","draggingNodeId","dragOverNodeId"]);Ue.TARGET_NODE_VIEWPORT_FRACTION=.2;Ue.PAN_DURATION_MS=750;Ue.LAYER_GAP=100;Ue.NODE_GAP=40;Ue.MARGIN_LEFT=40;Ue.MARGIN_TOP=40;hi([k({attribute:!1})],Ue.prototype,"store",2);hi([k({attribute:"selected-task-id"})],Ue.prototype,"selectedTaskId",2);hi([k({type:Boolean})],Ue.prototype,"readOnly",2);hi([k({type:Boolean})],Ue.prototype,"isolateMode",2);hi([U()],Ue.prototype,"panX",2);hi([U()],Ue.prototype,"panY",2);hi([U()],Ue.prototype,"scale",2);hi([U()],Ue.prototype,"isPanning",2);hi([U()],Ue.prototype,"draggingNodeId",2);hi([U()],Ue.prototype,"dragOverNodeId",2);Ue=hi([Oe("ft-dependency-view")],Ue);var e_=Object.defineProperty,t_=Object.getOwnPropertyDescriptor,Di=(e,t,i,s)=>{for(var r=s>1?void 0:s?t_(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&e_(t,i,r),r};const i_=/[\s\-_]/;function kl(e,t){const i=e.toLowerCase(),s=t.toLowerCase();let r=0,n=0,o=-1;for(let a=0;a<s.length&&r<i.length;a++)if(s[a]===i[r]){const c=o===-1?0:a-o-1;n+=c,(a===0||i_.test(s[a-1]))&&(n-=2),o=a,r++}return r===i.length?n:1/0}const s_={[W.UNSPECIFIED]:"",[W.TRIAGE]:"Triage",[W.ACCEPTED]:"Accepted",[W.WORKING]:"Working",[W.IN_REVIEW]:"In Review",[W.IN_QA]:"In QA",[W.DEPLOYING]:"Deploying",[W.COMPLETED]:"Completed",[W.WONT_FIX]:"Won't Fix",[W.DUPLICATE]:"Duplicate",[W.CANCELLED]:"Cancelled"},r_=[{type:fe.BLOCKS,label:"Blocks"},{type:fe.BLOCKED_BY,label:"Blocked by"}];let Mh=0,Xt=class extends ye{constructor(){super(...arguments),this.open=!1,this.store=null,this.mode="navigate",this.excludeTaskId="",this.searchQuery="",this.activeIndex=0,this.relationshipType=fe.BLOCKS,this.previouslyFocusedElement=null,this.labelId=`command-palette-label-${++Mh}`,this.listboxId=`command-palette-listbox-${Mh}`,this.onDocumentKeyDown=e=>{if(this.open)switch(e.key){case"Escape":e.preventDefault(),e.stopPropagation(),this.requestClose();break;case"ArrowDown":e.preventDefault(),this.moveActive(1);break;case"ArrowUp":e.preventDefault(),this.moveActive(-1);break;case"Enter":{e.preventDefault();const t=this.filteredTasks();t.length>0&&this.activeIndex<t.length&&this.selectTask(t[this.activeIndex].id);break}case"Tab":e.preventDefault();break}},this.onDocumentPointerDown=e=>{if(!this.open)return;const t=this.renderRoot.querySelector(".panel");t&&e.composedPath().includes(t)||this.requestClose()}}updated(e){e.has("open")&&(this.open?(this.searchQuery="",this.activeIndex=0,this.relationshipType=this.defaultRelationshipType??fe.BLOCKS,this.previouslyFocusedElement=this.deepActiveElement(),this.addDismissListeners(),this.updateComplete.then(()=>{var t;(t=this.inputEl)==null||t.focus()})):(this.removeDismissListeners(),this.restoreFocus()))}disconnectedCallback(){super.disconnectedCallback(),this.removeDismissListeners()}addDismissListeners(){document.addEventListener("keydown",this.onDocumentKeyDown,{capture:!0}),document.addEventListener("pointerdown",this.onDocumentPointerDown,{capture:!0})}removeDismissListeners(){document.removeEventListener("keydown",this.onDocumentKeyDown,{capture:!0}),document.removeEventListener("pointerdown",this.onDocumentPointerDown,{capture:!0})}searchableText(e){return[e.name,...e.labels].join(" ")}filteredTasks(){var s;const e=((s=this.store)==null?void 0:s.allTasks)??[],t=this.searchQuery.trim();if(!t)return[];const i=[];for(const r of e){if(this.mode==="add-relationship"&&r.id===this.excludeTaskId)continue;const n=kl(t,r.name),o=r.labels.map(l=>kl(t,l)),a=kl(t,this.searchableText(r)),c=[n,...o,a].filter(Number.isFinite);if(c.length===0)continue;const d=Math.min(...c);i.push({task:r,score:d})}return i.sort((r,n)=>r.score-n.score),i.map(r=>r.task).slice(0,50)}stageLabel(e){return s_[e.stage]??""}moveActive(e){const t=this.filteredTasks();t.length!==0&&(this.activeIndex=Math.max(0,Math.min(t.length-1,this.activeIndex+e)),this.scrollActiveIntoView())}scrollActiveIntoView(){this.updateComplete.then(()=>{const e=this.renderRoot.querySelector('.result-item[aria-selected="true"]');e==null||e.scrollIntoView({block:"nearest"})})}selectTask(e){this.mode==="add-relationship"?this.dispatchEvent(new CustomEvent("relationship-add",{bubbles:!0,composed:!0,detail:{targetTaskId:e,relationshipType:this.relationshipType}})):this.dispatchEvent(new CustomEvent("task-select",{bubbles:!0,composed:!0,detail:{taskId:e}})),this.requestClose()}deepActiveElement(){var t;let e=document.activeElement;for(;(t=e==null?void 0:e.shadowRoot)!=null&&t.activeElement;)e=e.shadowRoot.activeElement;return e instanceof HTMLElement?e:null}restoreFocus(){const e=this.previouslyFocusedElement;this.previouslyFocusedElement=null,e!=null&&e.isConnected&&e.focus()}requestClose(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}onInput(e){this.searchQuery=e.target.value,this.activeIndex=0}onItemPointerMove(e){this.activeIndex=e}onItemClick(e){this.selectTask(e)}onRelTypePillClick(e){this.relationshipType=e}shortId(e){return e.length>8?`...${e.slice(-6)}`:e}render(){if(!this.open)return Z;const e=this.filteredTasks(),t=this.mode==="add-relationship",i=t?"Search tasks to relate...":"Search tasks...",s=t?"add":"open";return T`
      <div class="backdrop">
        <div class="panel" role="dialog" aria-modal="true" aria-labelledby=${this.labelId}>
          <div class="search-row">
            <sl-icon class="search-icon" name="search"></sl-icon>
            <input
              id=${this.labelId}
              type="text"
              placeholder=${i}
              autocomplete="off"
              spellcheck="false"
              .value=${this.searchQuery}
              @input=${this.onInput}
              role="combobox"
              aria-expanded="true"
              aria-controls=${this.listboxId}
              aria-activedescendant=${e.length>0?`cp-item-${this.activeIndex}`:""}
            />
          </div>

          ${t?T`
                <div class="rel-type-row" role="radiogroup" aria-label="Relationship type">
                  <span class="rel-type-label">Type</span>
                  ${r_.map(({type:r,label:n})=>T`
                      <button
                        class="rel-type-pill"
                        role="radio"
                        aria-checked=${r===this.relationshipType?"true":"false"}
                        @click=${()=>this.onRelTypePillClick(r)}
                      >
                        ${n}
                      </button>
                    `)}
                </div>
              `:Z}

          <div class="results" id=${this.listboxId} role="listbox">
            ${e.length===0?T`<div class="empty">
                  ${this.searchQuery.trim()?"No matching tasks":"Type to search tasks…"}
                </div>`:e.map((r,n)=>{const o=this.stageLabel(r);return T`
                    <div
                      id="cp-item-${n}"
                      class="result-item"
                      role="option"
                      aria-selected=${n===this.activeIndex?"true":"false"}
                      @pointermove=${()=>this.onItemPointerMove(n)}
                      @click=${()=>this.onItemClick(r.id)}
                    >
                      <span class="task-id">${this.shortId(r.id)}</span>
                      <span class="task-name">${r.name}</span>
                      ${o?T`<span class="task-stage">${o}</span>`:Z}
                    </div>
                  `})}
          </div>

          <div class="footer">
            <span class="footer-hint"><kbd>&uarr;</kbd><kbd>&darr;</kbd> navigate</span>
            <span class="footer-hint"><kbd>&crarr;</kbd> ${s}</span>
            <span class="footer-hint"><kbd>esc</kbd> close</span>
          </div>
        </div>
      </div>
    `}};Xt.styles=ee`
    :host {
      display: contents;
    }

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: clamp(1rem, 10vh, 6rem) 1rem 1rem;
      background: rgba(15, 23, 42, 0.42);
    }

    .panel {
      width: min(36rem, 100%);
      max-height: min(28rem, calc(100vh - 4rem));
      display: flex;
      flex-direction: column;
      border: 1px solid var(--sl-color-neutral-200);
      border-radius: var(--sl-border-radius-medium);
      background: var(--sl-color-neutral-0);
      box-shadow: var(--sl-shadow-large);
      color: var(--sl-color-neutral-900);
      overflow: hidden;
    }

    .search-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--sl-color-neutral-200);
    }

    .search-icon {
      flex-shrink: 0;
      color: var(--sl-color-neutral-400);
      font-size: 1rem;
    }

    input {
      flex: 1;
      border: none;
      outline: none;
      font-family: var(--sl-font-sans);
      font-size: 0.9375rem;
      line-height: 1.4;
      color: var(--sl-color-neutral-900);
      background: transparent;
    }

    input::placeholder {
      color: var(--sl-color-neutral-400);
    }

    .rel-type-row {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 1rem;
      border-bottom: 1px solid var(--sl-color-neutral-200);
    }

    .rel-type-label {
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--sl-color-neutral-500);
      margin-right: 0.25rem;
    }

    .rel-type-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.1875rem 0.5rem;
      border-radius: 9999px;
      border: 1px solid var(--sl-color-neutral-300);
      background: var(--sl-color-neutral-0);
      font-family: var(--sl-font-sans);
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--sl-color-neutral-600);
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }

    .rel-type-pill:hover {
      border-color: var(--sl-color-primary-400);
      color: var(--sl-color-primary-600);
    }

    .rel-type-pill[aria-checked='true'] {
      background: var(--sl-color-primary-50);
      border-color: var(--sl-color-primary-500);
      color: var(--sl-color-primary-700);
      font-weight: 600;
    }

    .results {
      flex: 1;
      overflow-y: auto;
      padding: 0.25rem 0;
    }

    .empty {
      padding: 1.5rem 1rem;
      text-align: center;
      color: var(--sl-color-neutral-500);
      font-size: 0.875rem;
    }

    .result-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 1rem;
      cursor: pointer;
      font-size: 0.875rem;
      line-height: 1.4;
    }

    .result-item[aria-selected='true'] {
      background: var(--sl-color-primary-50);
    }

    .result-item:active {
      background: var(--sl-color-primary-100);
    }

    .task-id {
      flex-shrink: 0;
      color: var(--sl-color-neutral-400);
      font-family: var(--sl-font-mono);
      font-size: 0.75rem;
      min-width: 3rem;
    }

    .task-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--sl-color-neutral-800);
    }

    .task-stage {
      flex-shrink: 0;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--sl-color-neutral-500);
      background: var(--sl-color-neutral-100);
      padding: 0.125rem 0.375rem;
      border-radius: var(--sl-border-radius-small);
    }

    .footer {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.5rem 1rem;
      border-top: 1px solid var(--sl-color-neutral-200);
      font-size: 0.75rem;
      color: var(--sl-color-neutral-500);
    }

    .footer kbd {
      min-width: 1.25rem;
      padding: 0.0625rem 0.25rem;
      border: 1px solid var(--sl-color-neutral-300);
      border-bottom-width: 2px;
      border-radius: var(--sl-border-radius-small);
      background: var(--sl-color-neutral-50);
      color: var(--sl-color-neutral-600);
      font-family: var(--sl-font-mono);
      font-size: 0.6875rem;
      line-height: 1.35;
      text-align: center;
    }

    .footer-hint {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    @media (max-width: 520px) {
      .backdrop {
        align-items: flex-start;
        padding: 0;
      }
      .panel {
        width: 100%;
        max-height: 100vh;
        border-width: 0;
        border-radius: 0;
      }
    }
  `;Di([k({type:Boolean,reflect:!0})],Xt.prototype,"open",2);Di([k({attribute:!1})],Xt.prototype,"store",2);Di([k({type:String})],Xt.prototype,"mode",2);Di([k({type:String})],Xt.prototype,"excludeTaskId",2);Di([k({attribute:!1})],Xt.prototype,"defaultRelationshipType",2);Di([U()],Xt.prototype,"searchQuery",2);Di([U()],Xt.prototype,"activeIndex",2);Di([U()],Xt.prototype,"relationshipType",2);Di([le("input")],Xt.prototype,"inputEl",2);Xt=Di([Oe("ft-command-palette")],Xt);var n_=Object.defineProperty,o_=Object.getOwnPropertyDescriptor,Ge=(e,t,i,s)=>{for(var r=s>1?void 0:s?o_(t,i):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&n_(t,i,r),r};const El="LR";let He=class extends ye{constructor(){super(...arguments),this.taskStore=new J0,this.storeController=new Is(this,this.taskStore),this.onStatusChanged=(e=>{this.connectionStatus=e.detail.status}),this.onWatchUnsupported=(()=>{this.switchToPolling()}),this.onPollRefreshEnd=(e=>{this.lastRefreshed=e.detail.lastRefreshed,this.isRefreshing=!1}),this.onPollRefreshStart=(()=>{}),this.onPollRefreshError=(()=>{this.isRefreshing=!1}),this.routeToken=0,this._pendingTaskId=null,this.onSnapshotComplete=()=>{if(this._pendingTaskId){const e=this._pendingTaskId;this._pendingTaskId=null,this.taskStore.removeEventListener("snapshot-complete",this.onSnapshotComplete),this.taskStore.getTask(e)&&(this.selectedTaskId=e)}},this.currentView="dashboard",this.routeView="validating",this.currentCollectionId=null,this.collectionErrorMessage="",this.selectedTaskId=null,this.isolateMode=!1,this.layoutOrientation=El,this.connectionStatus="disconnected",this.shortcutOverlayOpen=!1,this.commandPaletteOpen=!1,this.commandPaletteMode="navigate",this.addRelationshipTaskId="",this.addRelationshipDefaultType=void 0,this.phaseFilter=null,this.assigneeFilter=null,this.users=[],this.isPolling=!1,this.lastRefreshed=null,this.isRefreshing=!1,this.dimOverlayVisible=!1,this.showLogin=!1,this.sessionUser=null,this.dimOverlayTimer=null,this.collectionLoadToken=0,this.userLoadToken=0,this.onDimOverlayInteraction=()=>{this.hideDimOverlay()},this.onManualRefresh=()=>{this.pollManager&&(this.isRefreshing=!0,this.pollManager.refresh())},this.onCollectionSelect=e=>{const t=e.detail.collectionId,i=new URL(window.location.href);i.searchParams.set("collection",t),i.searchParams.delete("task"),i.searchParams.delete("solo"),i.searchParams.delete("layoutdir"),window.history.pushState({},"",i),this.applyRoute()},this.onPopState=()=>{this.applyRoute()},this.onDocumentKeyDown=e=>{if(e.key==="k"&&(e.metaKey||e.ctrlKey)&&!e.defaultPrevented){e.preventDefault(),this.routeView==="board"&&(this.commandPaletteOpen?(this.commandPaletteOpen=!1,this.commandPaletteMode="navigate",this.addRelationshipTaskId=""):(this.commandPaletteMode="navigate",this.addRelationshipTaskId="",this.commandPaletteOpen=!0));return}e.key!=="?"||e.defaultPrevented||this.isEditableEventTarget(e)||(e.preventDefault(),this.shortcutOverlayOpen=!this.shortcutOverlayOpen)}}get isReadOnly(){return!this.currentCollection||this.currentCollection.platform===ke.FARMTABLE?!1:!this.isCollectionWritable(this.currentCollection)}get isExternalWritable(){return!this.currentCollection||this.currentCollection.platform===ke.FARMTABLE?!1:this.isCollectionWritable(this.currentCollection)}get capabilities(){if(this.currentCollection)return hy(this.currentCollection)}isCollectionWritable(e){const t=e.remoteData;return t&&typeof t=="object"&&"writable"in t?t.writable===!0:!1}connectedCallback(){super.connectedCallback(),this.unscopedClient=Nh({collectionId:null,readStoredCollectionId:!1}),this.client=this.unscopedClient,this.checkSessionAndRoute(),document.addEventListener("keydown",this.onDocumentKeyDown,{capture:!0}),window.addEventListener("popstate",this.onPopState)}disconnectedCallback(){var e,t,i;super.disconnectedCallback(),(e=this.streamManager)==null||e.removeEventListener("status-changed",this.onStatusChanged),(t=this.streamManager)==null||t.removeEventListener("watch-unsupported",this.onWatchUnsupported),(i=this.streamManager)==null||i.stop(),this.taskStore.removeEventListener("snapshot-complete",this.onSnapshotComplete),this.stopPolling(),this.hideDimOverlay(),document.removeEventListener("keydown",this.onDocumentKeyDown,{capture:!0}),window.removeEventListener("popstate",this.onPopState)}async checkSessionAndRoute(){if(localStorage.getItem("farmtable.token")){this.applyRoute();return}try{const t=await fetch("/api/auth/session");if(t.ok){const i=await t.json();this.sessionUser=i,this.showLogin=!1}else if(t.status===404)this.showLogin=!1;else{this.showLogin=!0;return}}catch{this.showLogin=!1}this.applyRoute()}render(){if(this.showLogin)return T`<ft-login-dialog></ft-login-dialog>`;if(this.routeView!=="board")return T`
        ${this.routeView==="validating"?T`<div class="placeholder"><sl-spinner style="font-size: 2rem;"></sl-spinner></div>`:T`
              <div class="landing">
                <ft-collection-list
                  .client=${this.unscopedClient}
                  .errorMessage=${this.collectionErrorMessage}
                  @collection-select=${this.onCollectionSelect}
                ></ft-collection-list>
              </div>
            `}
        <ft-shortcut-overlay
          .open=${this.shortcutOverlayOpen}
          @close=${this.onShortcutHelpClose}
        ></ft-shortcut-overlay>
      `;const e=this.storeController.taskStore.allTasks,t=e.length,i=this.phaseFilter!==null||this.assigneeFilter!==null?e.filter(s=>Dn(s,this.phaseFilter,this.assigneeFilter)).length:t;return T`
      <ft-toolbar
        .currentView=${this.currentView}
        .connectionStatus=${this.connectionStatus}
        .client=${this.client}
        .unscopedClient=${this.unscopedClient}
        .collectionId=${this.currentCollectionId??""}
        .phaseFilter=${this.phaseFilter}
        .assigneeFilter=${this.assigneeFilter}
        .layoutOrientation=${this.layoutOrientation}
        ?isPolling=${this.isPolling}
        .lastRefreshed=${this.lastRefreshed}
        ?isRefreshing=${this.isRefreshing}
        ?readOnly=${this.isReadOnly}
        ?externalWritable=${this.isExternalWritable}
        .sessionUser=${this.sessionUser}
        @view-change=${this.onViewChange}
        @filter-change=${this.onFilterChange}
        @shortcut-help-open=${this.onShortcutHelpOpen}
        @collection-select=${this.onCollectionSelect}
        @manual-refresh=${this.onManualRefresh}
        @logout=${this.onLogout}
      ></ft-toolbar>

      <ft-filter-chips
        .phaseFilter=${this.phaseFilter}
        .assigneeFilter=${this.assigneeFilter}
        .users=${this.users}
        .filteredCount=${i}
        .totalCount=${t}
        @filter-clear=${this.onFilterChange}
      ></ft-filter-chips>

      <div class="content">
        <div class="main">
          ${this.renderMainView()}
          ${this.dimOverlayVisible?T`<div class="dim-overlay"></div>`:null}
        </div>

        ${this.selectedTaskId?T`
              <div class="inspector">
                <ft-inspector
                  taskId=${this.selectedTaskId}
                  .store=${this.taskStore}
                  .client=${this.client}
                  ?readOnly=${this.isReadOnly}
                  .capabilities=${this.capabilities}
                  @close=${this.onInspectorClose}
                  @task-select=${this.onTaskSelect}
                  @task-update=${this.onTaskUpdate}
                  @open-add-relationship=${this.onOpenAddRelationship}
                ></ft-inspector>
              </div>
            `:null}
      </div>

      <ft-shortcut-overlay
        .open=${this.shortcutOverlayOpen}
        @close=${this.onShortcutHelpClose}
      ></ft-shortcut-overlay>
      <ft-command-palette
        .open=${this.commandPaletteOpen}
        .store=${this.taskStore}
        .mode=${this.commandPaletteMode}
        .excludeTaskId=${this.addRelationshipTaskId}
        .defaultRelationshipType=${this.addRelationshipDefaultType}
        @task-select=${this.onTaskSelect}
        @relationship-add=${this.onRelationshipAdd}
        @close=${this.onCommandPaletteClose}
      ></ft-command-palette>
    `}renderMainView(){if(this.taskStore.isLoading)return T`<div class="placeholder"><sl-spinner style="font-size: 2rem;"></sl-spinner></div>`;switch(this.currentView){case"dashboard":return T`
          <ft-dashboard-view
            .store=${this.taskStore}
            @view-change=${this.onViewChange}
          ></ft-dashboard-view>
        `;case"ready-queue":return T`
          <ft-ready-queue-view
            .store=${this.taskStore}
            .phaseFilter=${this.phaseFilter}
            .assigneeFilter=${this.assigneeFilter}
            selected-task-id=${this.selectedTaskId??""}
            @task-select=${this.onTaskSelect}
          ></ft-ready-queue-view>
        `;case"dependencies":return T`
          <ft-dependency-view
            .store=${this.taskStore}
            ?readOnly=${this.isReadOnly}
            ?isolateMode=${this.isolateMode}
            selected-task-id=${this.selectedTaskId??""}
            @task-select=${this.onTaskSelect}
            @dependency-drop=${this.onDependencyDrop}
            @isolate-toggle=${this.onIsolateToggle}
          ></ft-dependency-view>
        `;case"tree":return T`
          <ft-tree-view
            .store=${this.taskStore}
            .client=${this.client}
            .phaseFilter=${this.phaseFilter}
            .assigneeFilter=${this.assigneeFilter}
            ?readOnly=${this.isReadOnly}
            ?isolateMode=${this.isolateMode}
            .layoutOrientation=${this.layoutOrientation}
            .capabilities=${this.capabilities}
            selected-task-id=${this.selectedTaskId??""}
            @task-select=${this.onTaskSelect}
            @write-error=${this.onWriteError}
            @isolate-toggle=${this.onIsolateToggle}
            @layout-orientation-toggle=${this.onLayoutOrientationToggle}
          ></ft-tree-view>
        `;case"kanban":default:return T`
          <ft-kanban-view
            .store=${this.taskStore}
            .client=${this.client}
            .phaseFilter=${this.phaseFilter}
            .assigneeFilter=${this.assigneeFilter}
            ?readOnly=${this.isReadOnly}
            .capabilities=${this.capabilities}
            selected-task-id=${this.selectedTaskId??""}
            @task-select=${this.onTaskSelect}
            @write-error=${this.onWriteError}
          ></ft-kanban-view>
        `}}onViewChange(e){const t=e.detail.view,i=new URL(window.location.href);i.searchParams.set("view",t),window.history.pushState({},"",i),this.currentView=t,this.selectedTaskId&&!this.isTaskVisibleInCurrentView(this.selectedTaskId)?this.showDimOverlay():this.hideDimOverlay()}onFilterChange(e){const{phase:t,assigneeId:i}=e.detail;this.phaseFilter=t,this.assigneeFilter=i,this.selectedTaskId&&!this.isTaskVisibleInCurrentView(this.selectedTaskId)?this.showDimOverlay():this.hideDimOverlay()}async loadUsers(){const e=++this.userLoadToken;try{const t=await this.client.listUsers();e===this.userLoadToken&&(this.users=t)}catch(t){e===this.userLoadToken&&(this.users=[]),console.warn("Failed to load active filter chip users",t)}}onTaskSelect(e){this.selectedTaskId=e.detail.taskId,this.syncTaskToUrl(),this.selectedTaskId&&!this.isTaskVisibleInCurrentView(this.selectedTaskId)?this.showDimOverlay():this.hideDimOverlay()}isTaskVisibleInCurrentView(e){const t=this.taskStore.getTask(e);if(!t||this.currentView==="dashboard")return!1;if(this.currentView==="dependencies"){if(t.phase===ne.CLOSED)return!1;let i=!1;for(const s of t.relationships){if(s.type===fe.BLOCKED_BY){const r=this.taskStore.getTask(s.targetTaskId);if(r&&r.phase!==ne.CLOSED){i=!0;break}}if(s.type===fe.BLOCKS){const r=this.taskStore.getTask(s.targetTaskId);if(r&&r.phase!==ne.CLOSED){i=!0;break}}}if(!i&&(t.phase===ne.OPEN||t.phase===ne.IN_PROGRESS)){let s=!1;for(const r of t.relationships){if(r.type!==fe.BLOCKED_BY)continue;const n=this.taskStore.getTask(r.targetTaskId);if(n&&n.phase!==ne.CLOSED){s=!0;break}}i=!s}return i}return Dn(t,this.phaseFilter,this.assigneeFilter)?this.currentView==="ready-queue"?no(t,this.taskStore):!0:!1}showDimOverlay(){this.dimOverlayVisible=!0,this.clearDimOverlayTimer(),this.dimOverlayTimer=setTimeout(()=>{this.hideDimOverlay()},2500),requestAnimationFrame(()=>{this.dimOverlayVisible&&(document.addEventListener("click",this.onDimOverlayInteraction,{capture:!0}),document.addEventListener("keydown",this.onDimOverlayInteraction,{capture:!0}))})}hideDimOverlay(){this.dimOverlayVisible=!1,this.clearDimOverlayTimer(),document.removeEventListener("click",this.onDimOverlayInteraction,{capture:!0}),document.removeEventListener("keydown",this.onDimOverlayInteraction,{capture:!0})}clearDimOverlayTimer(){this.dimOverlayTimer&&(clearTimeout(this.dimOverlayTimer),this.dimOverlayTimer=null)}async onTaskUpdate(e){if(this.isReadOnly)return;const{taskId:t,fields:i}=e.detail;await this.applyTaskUpdate(t,i)}async applyTaskUpdate(e,t){var n,o,a,c,d;const i=this.taskStore.getTask(e);if(!i)return;const s=_p(i,t);this.taskStore.upsert(s),(n=this.pollManager)==null||n.markDirty(e);const r=[];if((o=t.addBlocks)!=null&&o.length)for(const l of t.addBlocks){const u=this.taskStore.getTask(l);u&&(r.some(p=>p.id===l)||r.push({id:l,original:u}),u.relationships.some(p=>p.type===fe.BLOCKED_BY&&p.targetTaskId===e)||this.taskStore.upsert({...u,relationships:[...u.relationships,{type:fe.BLOCKED_BY,targetTaskId:e}]}))}if((a=t.addBlockedBy)!=null&&a.length)for(const l of t.addBlockedBy){const u=this.taskStore.getTask(l);u&&(r.some(p=>p.id===l)||r.push({id:l,original:u}),u.relationships.some(p=>p.type===fe.BLOCKS&&p.targetTaskId===e)||this.taskStore.upsert({...u,relationships:[...u.relationships,{type:fe.BLOCKS,targetTaskId:e}]}))}if((c=t.removeRelationships)!=null&&c.length)for(const l of t.removeRelationships){const u=this.taskStore.getTask(l);if(u){r.some(h=>h.id===l)||r.push({id:l,original:u});const p=new Set(i.relationships.filter(h=>h.targetTaskId===l).map(h=>h.type===fe.BLOCKS?fe.BLOCKED_BY:h.type===fe.BLOCKED_BY?fe.BLOCKS:h.type));this.taskStore.upsert({...u,relationships:u.relationships.filter(h=>!(h.targetTaskId===e&&p.has(h.type)))})}}try{await this.client.updateTask(e,t)}catch(l){console.warn("Failed to update task; rolled back optimistic change",l),this.taskStore.upsert(i);for(const u of r)this.taskStore.upsert(u.original);this.showWriteError(l)}finally{(d=this.pollManager)==null||d.clearDirty(e)}}showWriteError(e){const t=e instanceof Error?e.message:typeof e=="string"?e:String(e);let i;/permission|403|forbidden/i.test(t)?i="GitHub rejected this edit — your token may not have write access":/rate.?limit|429|too many requests/i.test(t)?i="GitHub rate limit reached — please wait before making more edits":/network|fetch|ECONNREFUSED|unavailable|deadline/i.test(t)?i="Could not reach the server — your change will retry on the next sync":i=`Failed to save changes: ${t}`;const s=Object.assign(document.createElement("sl-alert"),{variant:"danger",closable:!0,duration:8e3}),r=document.createElement("sl-icon");r.slot="icon",r.setAttribute("name","exclamation-triangle"),s.append(r,document.createTextNode(i)),document.body.appendChild(s),s.toast()}onWriteError(e){this.showWriteError(e.detail.error)}onIsolateToggle(e){this.isolateMode=e.detail.isolateMode,this.syncSoloToUrl()}onLayoutOrientationToggle(e){this.layoutOrientation=e.detail.layoutOrientation,this.syncLayoutDirToUrl()}onInspectorClose(){this.selectedTaskId=null,this.isolateMode&&(this.isolateMode=!1,this.syncSoloToUrl()),this.syncTaskToUrl(),this.hideDimOverlay()}onShortcutHelpOpen(){this.shortcutOverlayOpen=!0}onShortcutHelpClose(){this.shortcutOverlayOpen=!1}async applyRoute(){const e=++this.routeToken,t=new URLSearchParams(window.location.search),i=t.get("collection"),s=t.get("view"),r=t.get("task"),n=t.get("solo"),o=t.get("layoutdir"),a=new Set(["kanban","tree","dashboard","ready-queue","dependencies"]),c=r&&!s?"kanban":"dashboard";if(this.currentView=a.has(s??"")?s:c,!i){this.showCollectionList("");return}this._pendingTaskId=r||null,this.isolateMode=n==="1"&&!!this._pendingTaskId,this.layoutOrientation=o==="TB"||o==="LR"?o:El,this.routeView="validating",this.collectionErrorMessage="";try{if(await this.unscopedClient.getCollection(i),e!==this.routeToken)return;this.showBoard(i)}catch(d){if(e!==this.routeToken)return;console.warn("Collection from URL was not found",d),this.removeCollectionFromUrl(),this.showCollectionList("Collection not found. Choose an available collection.")}}showCollectionList(e){this.stopStream(),this.stopPolling(),this.taskStore.removeEventListener("snapshot-complete",this.onSnapshotComplete),this._pendingTaskId=null,this.client=this.unscopedClient,this.currentCollectionId=null,this.taskStore.clear(),this.selectedTaskId=null,this.isolateMode=!1,this.users=[],this.currentCollection=void 0,this.connectionStatus="disconnected",this.collectionErrorMessage=e,this.routeView="landing"}showBoard(e){this.stopStream(),this.stopPolling(),this.taskStore.removeEventListener("snapshot-complete",this.onSnapshotComplete),this.phaseFilter=null,this.assigneeFilter=null,this.currentCollectionId=e,this.client=Nh({collectionId:e,readStoredCollectionId:!1}),this.taskStore.clear(),this.selectedTaskId=null,this.connectionStatus="disconnected",this.collectionErrorMessage="",this.routeView="board",this._pendingTaskId&&this.taskStore.addEventListener("snapshot-complete",this.onSnapshotComplete),this.streamManager=new Hl(this.client,this.taskStore),this.streamManager.addEventListener("status-changed",this.onStatusChanged),this.streamManager.addEventListener("watch-unsupported",this.onWatchUnsupported),this.streamManager.start(),this.loadUsers(),this.loadCurrentCollection()}stopStream(){var e,t,i;(e=this.streamManager)==null||e.removeEventListener("status-changed",this.onStatusChanged),(t=this.streamManager)==null||t.removeEventListener("watch-unsupported",this.onWatchUnsupported),(i=this.streamManager)==null||i.stop(),this.streamManager=void 0}switchToPolling(){this.stopStream(),this.isPolling=!0,this.connectionStatus="polling";const e=this.isExternalWritable?15e3:Nr.DEFAULT_INTERVAL_MS;this.pollManager=new Nr(this.client,this.taskStore,e),this.pollManager.addEventListener("refresh-start",this.onPollRefreshStart),this.pollManager.addEventListener("refresh-end",this.onPollRefreshEnd),this.pollManager.addEventListener("refresh-error",this.onPollRefreshError),this.pollManager.start()}stopPolling(){this.pollManager&&(this.pollManager.removeEventListener("refresh-start",this.onPollRefreshStart),this.pollManager.removeEventListener("refresh-end",this.onPollRefreshEnd),this.pollManager.removeEventListener("refresh-error",this.onPollRefreshError),this.pollManager.stop(),this.pollManager=void 0),this.isPolling=!1,this.lastRefreshed=null,this.isRefreshing=!1}async onLogout(){try{await fetch("/api/auth/session",{method:"DELETE"})}catch{}window.location.reload()}async loadCurrentCollection(){const e=++this.collectionLoadToken;if(!this.currentCollectionId){this.currentCollection=void 0;return}try{const t=await this.unscopedClient.getCollection(this.currentCollectionId);e===this.collectionLoadToken&&(this.currentCollection=t,this.reconfigurePollInterval())}catch(t){e===this.collectionLoadToken&&(this.currentCollection=void 0,this.reconfigurePollInterval()),console.warn("Failed to load current collection",t)}}reconfigurePollInterval(){if(this.pollManager){const e=this.isExternalWritable?15e3:Nr.DEFAULT_INTERVAL_MS;this.pollManager.setInterval(e)}}removeCollectionFromUrl(){const e=new URL(window.location.href);e.searchParams.delete("collection"),e.searchParams.delete("view"),e.searchParams.delete("task"),e.searchParams.delete("solo"),e.searchParams.delete("layoutdir"),window.history.replaceState({},"",e)}syncTaskToUrl(){const e=new URL(window.location.href);this.selectedTaskId?e.searchParams.set("task",this.selectedTaskId):e.searchParams.delete("task"),window.history.replaceState({},"",e)}syncSoloToUrl(){const e=new URL(window.location.href);this.isolateMode?e.searchParams.set("solo","1"):e.searchParams.delete("solo"),window.history.replaceState({},"",e)}syncLayoutDirToUrl(){const e=new URL(window.location.href);this.layoutOrientation!==El?e.searchParams.set("layoutdir",this.layoutOrientation):e.searchParams.delete("layoutdir"),window.history.replaceState({},"",e)}onCommandPaletteClose(){this.commandPaletteOpen=!1,this.commandPaletteMode="navigate",this.addRelationshipTaskId="",this.addRelationshipDefaultType=void 0}onOpenAddRelationship(e){const{taskId:t,relationshipType:i}=e.detail;this.addRelationshipTaskId=t,this.addRelationshipDefaultType=i,this.commandPaletteMode="add-relationship",this.commandPaletteOpen=!0}async onRelationshipAdd(e){if(this.isReadOnly)return;const{targetTaskId:t,relationshipType:i}=e.detail,s=this.addRelationshipTaskId;if(!s)return;let r;i===fe.BLOCKED_BY?r={addBlockedBy:[t]}:r={addBlocks:[t]},await this.applyTaskUpdate(s,r)}async onDependencyDrop(e){if(this.isReadOnly)return;const{sourceTaskId:t,targetTaskId:i}=e.detail;await this.applyTaskUpdate(t,{addBlockedBy:[i]})}isEditableEventTarget(e){return e.composedPath().some(i=>{if(!(i instanceof HTMLElement))return!1;const s=i.tagName.toLowerCase();return i.isContentEditable||s==="input"||s==="textarea"||s==="select"||s==="sl-input"||s==="sl-textarea"||s==="sl-select"})}};He.styles=ee`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      font-family: var(--sl-font-sans);
    }
    .content {
      flex: 1;
      display: flex;
      min-height: 0;
      overflow: hidden;
    }
    .main {
      flex: 1;
      min-width: 0;
      overflow: auto;
      padding: 1rem;
      position: relative;
    }
    .dim-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10;
      pointer-events: none;
      animation: dim-fade-in 0.2s ease-out;
    }
    @keyframes dim-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .landing {
      flex: 1;
      overflow: auto;
      min-height: 0;
    }
    .placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--sl-color-neutral-500);
      font-size: 1.2rem;
    }
    .inspector {
      width: 400px;
      flex-shrink: 0;
      border-left: 1px solid var(--sl-color-neutral-200);
      padding: 1rem;
      overflow: hidden;
      background: var(--sl-color-neutral-50);
    }
  `;Ge([U()],He.prototype,"currentView",2);Ge([U()],He.prototype,"routeView",2);Ge([U()],He.prototype,"currentCollectionId",2);Ge([U()],He.prototype,"collectionErrorMessage",2);Ge([U()],He.prototype,"selectedTaskId",2);Ge([U()],He.prototype,"isolateMode",2);Ge([U()],He.prototype,"layoutOrientation",2);Ge([U()],He.prototype,"connectionStatus",2);Ge([U()],He.prototype,"shortcutOverlayOpen",2);Ge([U()],He.prototype,"commandPaletteOpen",2);Ge([U()],He.prototype,"commandPaletteMode",2);Ge([U()],He.prototype,"addRelationshipTaskId",2);Ge([U()],He.prototype,"addRelationshipDefaultType",2);Ge([U()],He.prototype,"phaseFilter",2);Ge([U()],He.prototype,"assigneeFilter",2);Ge([U()],He.prototype,"users",2);Ge([U()],He.prototype,"isPolling",2);Ge([U()],He.prototype,"lastRefreshed",2);Ge([U()],He.prototype,"isRefreshing",2);Ge([U()],He.prototype,"currentCollection",2);Ge([U()],He.prototype,"dimOverlayVisible",2);Ge([U()],He.prototype,"showLogin",2);Ge([U()],He.prototype,"sessionUser",2);He=Ge([Oe("ft-app")],He);Cl("/shoelace");
//# sourceMappingURL=index-Df6e9qlL.js.map
