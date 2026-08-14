/*
===========================================================================
SweetGift.ru | Share Module
---------------------------------------------------------------------------
Единый модуль "Поделиться":
- на iOS / Android открывает системное меню navigator.share
- на desktop показывает выпадающее меню
===========================================================================
*/

(function () {
  'use strict';

  window.SG = window.SG || {};

  if (window.SG.share) return;

  var SHARE_ICON_URL = 'https://static.tildacdn.com/tild3637-6435-4566-b931-313465363363/share_3882403.png';

  function injectCss() {
    if (document.getElementById('sg-share-css')) return;

    var style = document.createElement('style');
    style.id = 'sg-share-css';

    style.textContent = `
.sg-share-box{
  position:relative;
  display:flex;
  align-items:center;
  margin:12px 0 16px 0;
  font-family:Arial,sans-serif;
}

.sg-share-main{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:9px;
  height:42px;
  padding:0 18px;
  border:1px solid #e8e8e8;
  border-radius:12px;
  background:#fff;
  color:#555;
  font-size:16px;
  font-weight:500;
  cursor:pointer;
  transition:.2s ease;
}

.sg-share-main:hover{
  border-color:#e60000;
  color:#e60000;
}

.sg-share-icon{
  width:18px;
  height:18px;
  display:block;
  object-fit:contain;
}

.sg-share-menu{
  display:none;
  position:absolute;
  left:0;
  top:50px;
  min-width:230px;
  background:#fff;
  border-radius:14px;
  box-shadow:0 10px 30px rgba(0,0,0,.14);
  padding:8px 0;
  z-index:99999;
}

.sg-share-box.is-open .sg-share-menu{
  display:block;
}

.sg-share-menu a{
  display:flex;
  align-items:center;
  gap:11px;
  padding:11px 16px;
  color:#222;
  text-decoration:none;
  font-size:15px;
}

.sg-share-channel-icon{
  display:inline-flex;
  flex:0 0 28px;
  width:28px;
  height:28px;
  align-items:center;
  justify-content:center;
  border-radius:50%;
  background:#777;
  color:#fff;
  font:700 11px/1 Arial,sans-serif;
}
.sg-share-channel-telegram{background:#27a7e7}.sg-share-channel-max{background:linear-gradient(135deg,#735cff,#27c4f3)}
.sg-share-channel-vk{background:#2787f5}.sg-share-channel-whatsapp{background:#25d366}
.sg-share-channel-ok{background:#ee8208}.sg-share-channel-viber{background:#7360f2}
.sg-share-channel-facebook{background:#1877f2}.sg-share-channel-x{background:#111}
.sg-share-channel-email{background:#6b7280}.sg-share-channel-copy{background:#a9284d}

.sg-share-menu a:hover{
  background:#f7f7f7;
  color:#e60000;
}

@media(max-width:640px){
  .sg-share-menu{
    width:230px;
    max-width:calc(100vw - 50px);
  }
}
`;

    document.head.appendChild(style);
  }

  function createShareBox(options) {
    injectCss();

    options = options || {};

    var box = document.createElement('div');
    box.className = options.className || 'sg-share-box';

    var labels = {
      telegram: 'Telegram',
      whatsapp: 'WhatsApp',
      vk: 'ВКонтакте',
      max: 'MAX',
      ok: 'Одноклассники',
      viber: 'Viber',
      facebook: 'Facebook',
      x: 'X',
      email: 'Электронная почта',
      copy: 'Скопировать ссылку'
    };
    var marks = {telegram:'TG',whatsapp:'WA',vk:'VK',max:'M',ok:'OK',viber:'V',facebook:'f',x:'X',email:'✉',copy:'⧉'};
    var channels = options.channels || ['telegram', 'whatsapp', 'vk', 'max', 'copy'];
    var menu = channels.filter(function (channel) {
      return labels[channel];
    }).map(function (channel) {
      return '<a href="#" data-sg-share="' + channel + '"><span class="sg-share-channel-icon sg-share-channel-' + channel + '" aria-hidden="true">' + marks[channel] + '</span><span class="sg-share-label">' + labels[channel] + '</span></a>';
    }).join('');

    box.innerHTML = `
      <button class="sg-share-main" type="button">
        <img src="${SHARE_ICON_URL}" class="sg-share-icon" alt="Поделиться">
        <span>${options.buttonText || 'Поделиться'}</span>
      </button>

      <div class="sg-share-menu">
        ${menu}
      </div>
    `;

    box.__sgShareOptions = options;

    return box;
  }

  async function openNativeShare(options) {
    options = options || {};

    try {
      await navigator.share({
        title: options.title || document.title || '',
        text: options.text || options.title || document.title || '',
        url: options.url || window.location.href
      });
      if (typeof options.onShare === 'function') options.onShare('native');
    } catch (e) {}
  }

  function openShare(channel, options, clickedLink) {
    options = options || {};

    var rawUrl = options.url || window.location.href;
    var rawTitle = options.title || document.title || '';

    var url = encodeURIComponent(rawUrl);
    var title = encodeURIComponent(rawTitle);

    if (channel === 'telegram') {
      window.open('https://t.me/share/url?url=' + url + '&text=' + title, '_blank');
      if (typeof options.onShare === 'function') options.onShare(channel);
      return;
    }

    if (channel === 'whatsapp') {
      window.open('https://wa.me/?text=' + title + '%20' + url, '_blank');
      if (typeof options.onShare === 'function') options.onShare(channel);
      return;
    }

    if (channel === 'vk') {
      window.open('https://vk.com/share.php?url=' + url, '_blank');
      if (typeof options.onShare === 'function') options.onShare(channel);
      return;
    }

    if (channel === 'max') {
      if (typeof options.onShare === 'function') options.onShare(channel);
      window.location.href = 'max://send?text=' + url;
      return;
    }

    if (channel === 'ok') {
      window.open('https://connect.ok.ru/offer?url=' + url + '&title=' + title, '_blank');
      if (typeof options.onShare === 'function') options.onShare(channel);
      return;
    }

    if (channel === 'viber') {
      window.location.href = 'viber://forward?text=' + title + '%20' + url;
      if (typeof options.onShare === 'function') options.onShare(channel);
      return;
    }

    if (channel === 'facebook') {
      window.open('https://www.facebook.com/sharer/sharer.php?u=' + url, '_blank');
      if (typeof options.onShare === 'function') options.onShare(channel);
      return;
    }

    if (channel === 'x') {
      window.open('https://twitter.com/intent/tweet?url=' + url + '&text=' + title, '_blank');
      if (typeof options.onShare === 'function') options.onShare(channel);
      return;
    }

    if (channel === 'email') {
      window.location.href = 'mailto:?subject=' + title + '&body=' + title + '%0A' + url;
      if (typeof options.onShare === 'function') options.onShare(channel);
      return;
    }

    if (channel === 'copy') {
      navigator.clipboard.writeText(rawUrl);
      if (typeof options.onShare === 'function') options.onShare(channel);

      if (clickedLink) {
        var label = clickedLink.querySelector('.sg-share-label') || clickedLink;
        var oldText = label.textContent;
        label.textContent = 'Ссылка скопирована';

        setTimeout(function () {
          label.textContent = oldText;
        }, 1500);
      }
    }
  }

  document.addEventListener('click', function (e) {
    var main = e.target.closest('.sg-share-main');

    if (main) {
      e.preventDefault();
      e.stopPropagation();

      var box = main.closest('.sg-share-box');
      var options = box && box.__sgShareOptions ? box.__sgShareOptions : {};

      if (navigator.share && window.innerWidth <= 768) {
        openNativeShare(options);
        return;
      }

      if (box) {
        box.classList.toggle('is-open');
      }

      return;
    }

    var shareLink = e.target.closest('[data-sg-share]');

    if (shareLink) {
      e.preventDefault();
      e.stopPropagation();

      var shareBox = shareLink.closest('.sg-share-box');
      var shareOptions = shareBox && shareBox.__sgShareOptions ? shareBox.__sgShareOptions : {};
      var channel = shareLink.getAttribute('data-sg-share');

      openShare(channel, shareOptions, shareLink);

      if (shareBox) {
        shareBox.classList.remove('is-open');
      }

      return;
    }

    document.querySelectorAll('.sg-share-box.is-open').forEach(function (box) {
      box.classList.remove('is-open');
    });
  });

  window.SG.share = {
    create: createShareBox,
    openNative: openNativeShare,
    open: openShare
  };

})();
