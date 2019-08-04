'use strict';

// ----------------- Internationalization ------------------
document.querySelectorAll('[data-i18n]').forEach(node => {
  let [text, attr] = node.dataset.i18n.split('|');
  text = chrome.i18n.getMessage(text);
  attr ? node[attr] = text : node.appendChild(document.createTextNode(text));
});
// ----------------- /Internationalization -----------------

// ----- global
let oldProxySetting;
const color = new jscolor('colorChooser', {uppercase: false, hash: true});
color.fromString(DEFAULT_COLOR); // starting from default color

const header = document.querySelector('.header'); // dynamic header
setHeader();

// ----- check for Edit
const id = localStorage.getItem('id');
if (id) { // This is an edit operation

  const sync = localStorage.getItem('sync');

  // clear localStorage
  localStorage.removeItem('id');
  localStorage.removeItem('sync');

  const API = sync === 'true' ? chrome.storage.sync : chrome.storage.local;
  API.get(id, result => {
console.log(result);    
    if (!Object.keys(result).length) {
      
      if (id === LASTRESORT) { // error prevention
        processOptions(DEFAULT_PROXY_SETTING);
        return;
      }      
      console.error('Unable to edit saved proxy (could not get existing settings)')
      return;
    }
    
    result[id].id = id;
    processOptions(result[id]);
  })
}


// --- show & hide element using CSS
const nav = [...document.querySelectorAll('input[name="nav"]')];
//nav[0].checked = true;

const proxyType = document.querySelector('#proxyType');
proxyType.addEventListener('change', function() { nav[this.value -1].checked = true; });

const proxyTitle = document.querySelector('#proxyTitle');
proxyTitle.focus();

const proxyAddress =  document.querySelector('#proxyAddress');
const proxyPort = document.querySelector('#proxyPort');
const proxyUsername = document.querySelector('#proxyUsername');
const proxyPassword = document.querySelector('#proxyPassword');
const proxyActive = document.querySelector('#proxyActive');
const proxyDNS = document.querySelector('#proxyDNS');
const pacURL = document.querySelector('#pacURL');

// --- remove nodes completely for FP Basic
FOXYPROXY_BASIC && document.querySelectorAll('.notForBasic').forEach(item => item.remove());

// --- add Listeners
document.querySelectorAll('button').forEach(item => item.addEventListener('click', process));
function process() {

  switch (this.dataset.i18n) {

    case 'cancel':
      // prevent Firefox's save password prompt
      proxyPassword.value = '';
      location.href = '/options.html';
      break;

    case 'saveAdd':
      if (!validateInput()) { return; }
      saveProxySetting().then(resetOptions)
      .catch((e) => console.error('Error saving proxy: ' + e));
      break;

    case 'saveEditPattern':
      if (!validateInput()) { return; }
      saveProxySetting().then((id) => location.href = '/patterns.html?id=' + Utils.jsonObject2UriComponent(id))
      .catch((e) => console.error('Error saving proxy: ' + e));
      break;

    case 'save':
      if (!validateInput()) { return; }
      saveProxySetting().then(() => location.href = '/options.html')
      .catch((e) => console.error('Error saving proxy: ' + e));
      break;

    case 'togglePW|title':
      const inp = this.nextElementSibling;
      inp.type = inp.type === 'password' ? 'text' : 'password';
      break;
  }
}

function setHeader(proxy) {

  if (proxy) {
    document.title = 'FoxyProxy ' + chrome.i18n.getMessage('editProxy', '');
    header.textContent = chrome.i18n.getMessage('editProxy', proxy.title || `${proxy.address}:${proxy.port}`);
    return;
  }
  document.title = 'FoxyProxy ' + chrome.i18n.getMessage('addProxy');
  header.textContent = chrome.i18n.getMessage('addProxy');
}


function processOptions(proxy) {

    //console.log(proxy);
    oldProxySetting = proxy;

    // Populate the form
    setHeader(proxy);

    // input
    proxyTitle.value = proxy.title || '';
    proxyAddress.value = proxy.address || '';
    proxyPort.value = proxy.port || '';
    proxyUsername.value = proxy.username || '';
    proxyPassword.value = proxy.password || '';
    pacURL.value = proxy.pacURL || '';

    // select
    proxyType.value = proxy.type;

    // checkbox
    proxyActive.checked = proxy.active;
    proxyDNS.checked = proxy.proxyDNS || false;

    // color
    color.fromString(proxy.color || DEFAULT_COLOR);
}

function resetOptions() {

  setHeader();

  //proxyType.value = '1'; // http
  
  // to help entering sets quickly, some fields are kept
  [proxyTitle, proxyAddress].forEach(item => item.value = '');
  //document.querySelectorAll('input[type="text"]').forEach(item => item.value = '');
  //document.querySelectorAll('input[type="checkbox"]').forEach(item => item.checked = true);

  color.fromString(DEFAULT_COLOR);

  proxyTitle.focus();
}


function saveProxySetting() {

  let proxySetting = {};

  proxySetting.type = proxyType.value *1;
  proxySetting.color = document.querySelector('#colorChooser').value;
  if (proxyTitle.value) { proxySetting.title = proxyTitle; }
  proxySetting.active = true; // default

  if (proxySetting.type !== PROXY_TYPE_NONE) {

    proxySetting.address = proxyAddress.value;
    proxySetting.port = proxyPort.value *1;
    if (proxySetting.type === PROXY_TYPE_SOCKS5 && proxyDNS.checked) { proxySetting.proxyDNS = true; }
    proxySetting.active = proxyActive.checked;
    // already trimmed in validateInput() , don't store ''
    if (proxyUsername.value) { proxySetting.username = proxyUsername.value; }
    if (proxyPassword.value) { proxySetting.password = proxyPassword.value; }
  }

    // prevent Firefox's save password prompt
    proxyPassword.value = '';

  if (oldProxySetting) { // Edit operation
    proxySetting.whitePatterns = oldProxySetting.whitePatterns;
    proxySetting.blackPatterns = oldProxySetting.blackPatterns;
    if (oldProxySetting.pacURL) { proxySetting.pacURL = oldProxySetting.pacURL; } // imported foxyproxy.xml
    return editProxySetting(oldProxySetting.id, oldProxySetting.index, proxySetting);
  }
  else { // Add operation
    // Do not use this proxy for internal IP addresses.
    proxySetting.whitePatterns = document.querySelector('#onOffWhiteAll').checked ? [PATTERN_ALL_WHITE] : [];

    proxySetting.blackPatterns = document.querySelector('#onOffBlackAll').checked ?
      [PATTERN_LOCALHOSTURLS_BLACK, PATTERN_INTERNALIPS_BLACK, PATTERN_LOCALHOSTNAMES_BLACK] : [];

    return addProxySetting(proxySetting);
  }
}

function validateInput() {

  Utils.trimAllInputs();

  // let's handle here, #proxyPort will be checks later separately
  // Utils.escapeAllInputs('#proxyTitle,#proxyAddress,#proxyPort');
  // escape all inputs
  [proxyTitle, proxyAddress].forEach(item => item.value = item.value.replace(/[&<>"']+/g, ''));

  if (proxyType.value *1 === PROXY_TYPE_NONE) { return true; }

  // checking proxyAddress
  proxyAddress.classList.remove('invalid'); // reset
  if (!proxyAddress.value) {
    proxyAddress.classList.add('invalid');
    return false;
  }

  // checking proxyPort
  proxyPort.classList.remove('invalid'); // reset
  if (!proxyPort.value *1) { // check to see if it is a digit and not 0
    proxyPort.classList.add('invalid');
    return false;
  }

  return true;
}