/*
===========================================================================
SweetGift.ru | Article Stats
---------------------------------------------------------------------------
✓ просмотры статей
✓ лайки
✓ время чтения
✓ дата публикации / обновления
✓ поделиться
✓ работает только на /stati/*
===========================================================================
*/

(function(){

  const SUPABASE_URL = 'https://rvgvbxipccbkytmhltmi.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_JrPJQVLLpcDxjte5OSCnvg_ocvpBqqT';

  function injectCss(){
    if(document.getElementById('sg-article-stats-css')) return;

    const css = `
.uc-like-up{
  max-width:960px;
  margin:22px auto 35px auto;
  font-family:Arial,sans-serif;
}

.sg-meta-one{
  display:flex;
  align-items:center;
  justify-content:flex-start;
  gap:34px;
  color:#666;
  font-size:18px;
}

.sg-meta-date{
  font-size:16px;
  color:#666;
}

.sg-meta-item{
  position:relative;
  display:flex;
  align-items:center;
  gap:8px;
  border:0;
  background:none;
  padding:0;
  margin:0;
  font:inherit;
  color:#666;
}

.sg-like-btn{
  cursor:pointer;
}

.sg-like-btn:hover,
.sg-like-btn.is-liked{
  color:#e60000;
}

.sg-meta-item[data-tooltip]:hover:after{
  content:attr(data-tooltip);
  position:absolute;
  left:50%;
  transform:translateX(-50%);
  top:34px;
  background:#555;
  color:#fff;
  padding:9px 14px;
  border-radius:7px;
  font-size:14px;
  white-space:nowrap;
  z-index:9999;
}

.sg-meta-item[data-tooltip]:hover:before{
  content:"";
  position:absolute;
  left:50%;
  transform:translateX(-50%);
  top:27px;
  border-left:6px solid transparent;
  border-right:6px solid transparent;
  border-bottom:7px solid #555;
}

.uc-like-down{
  max-width:960px;
  margin:55px auto;
  font-family:Arial,sans-serif;
}

.sg-down-wrap{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:70px;
  font-size:20px;
  color:#777;
}

.sg-down-item,
.sg-down-like{
  position:relative;
  display:flex;
  align-items:center;
  gap:10px;
}

.sg-down-like{
  border:0;
  background:none;
  font:inherit;
  cursor:pointer;
  color:#777;
  padding:0;
}

.sg-down-like:hover,
.sg-down-like.is-liked{
  color:#e60000;
}

.sg-down-item[data-tooltip]:hover:after,
.sg-down-like[data-tooltip]:hover:after{
  content:attr(data-tooltip);
  position:absolute;
  left:50%;
  transform:translateX(-50%);
  top:-45px;
  background:#555;
  color:#fff;
  padding:8px 12px;
  border-radius:8px;
  white-space:nowrap;
  font-size:14px;
  z-index:9999;
}

.sg-down-item[data-tooltip]:hover:before,
.sg-down-like[data-tooltip]:hover:before{
  content:"";
  position:absolute;
  left:50%;
  transform:translateX(-50%);
  top:-12px;
  border-left:6px solid transparent;
  border-right:6px solid transparent;
  border-top:7px solid #555;
}

/* Новый общий Share */

.sg-article-share-placeholder{
  display:flex;
  align-items:center;
}

.sg-article-share-box{
  margin:0 !important;
}

.sg-article-share-box .sg-share-main{
  padding:0 !important;
  border:none !important;
  background:transparent !important;
  box-shadow:none !important;
  color:#777 !important;
  font-size:20px !important;
  font-weight:400 !important;
  height:auto !important;
  gap:8px !important;
}

.sg-article-share-box .sg-share-main:hover{
  color:#e60000 !important;
}

.sg-article-share-box .sg-share-icon{
  width:18px;
  height:18px;
}

.sg-mobile-tip{
  position:absolute;
  transform:translateX(-50%);
  background:#555;
  color:#fff;
  padding:8px 14px;
  border-radius:8px;
  font-size:13px;
  white-space:nowrap;
  z-index:999999;
  font-family:Arial,sans-serif;
  box-shadow:0 5px 18px rgba(0,0,0,.15);
}

@media(max-width:640px){

  .uc-like-up{
    margin:15px 20px 24px 20px;
  }

  .sg-meta-one{
    display:flex;
    flex-wrap:wrap;
    gap:12px 22px;
    align-items:center;
    font-size:15px;
  }

  .sg-meta-date{
    width:100%;
    font-size:15px;
    margin-bottom:2px;
  }

  .sg-meta-item{
    font-size:15px;
    gap:6px;
  }

  .sg-meta-item span{
    font-size:15px;
  }

  .sg-meta-item:hover:after,
  .sg-meta-item:hover:before,
  .sg-down-item:hover:after,
  .sg-down-item:hover:before,
  .sg-down-like:hover:after,
  .sg-down-like:hover:before{
    display:none!important;
  }

  .uc-like-down{
    margin:40px 20px;
  }

  .sg-down-wrap{
    gap:26px;
    font-size:17px;
    flex-wrap:wrap;
  }

  .sg-article-share-box .sg-share-main{
    font-size:17px !important;
  }

}
`;


    const style = document.createElement('style');
    style.id = 'sg-article-stats-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function isArticlePage(){
    const path = window.location.pathname;

    if(path === '/stati' || path === '/stati/'){
      return false;
    }

    return path.indexOf('/stati/') === 0;
  }

  function formatNumber(num){
    return Number(num || 0).toLocaleString('ru-RU');
  }

  function loadSupabase(callback){
    if(window.supabase){
      callback();
      return;
    }

    const existing = document.querySelector('script[src*="supabase-js"]');

    if(existing){
      const timer = setInterval(function(){
        if(window.supabase){
          clearInterval(timer);
          callback();
        }
      }, 100);

      setTimeout(function(){
        clearInterval(timer);
      }, 7000);

      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.async = true;
    script.onload = callback;
    document.head.appendChild(script);
  }

  function getStableReadTimeByUrl(path){
    let hash = 0;

    for(let i = 0; i < path.length; i++){
      hash = ((hash << 5) - hash) + path.charCodeAt(i);
      hash = hash & hash;
    }

    return (Math.abs(hash) % 7) + 3;
  }

  function getReadingTime(articleKey){
    const selectors = [
      '.t-feed__post-content',
      '.t-text',
      '.t-rec',
      'article',
      'main'
    ];

    let text = '';

    for(const selector of selectors){
      const el = document.querySelector(selector);

      if(el && el.innerText && el.innerText.length > 500){
        text = el.innerText;
        break;
      }
    }

    if(!text){
      return getStableReadTimeByUrl(articleKey);
    }

    text = text.replace(/\s+/g, ' ').trim();

    const words = text.split(' ').filter(Boolean).length;

    if(words < 100){
      return getStableReadTimeByUrl(articleKey);
    }

    return Math.max(3, Math.min(30, Math.ceil(words / 180)));
  }

  function renderUp(box, views, likes, date, isLiked, readTime){
    box.innerHTML = `
      <div class="sg-meta-one">
        <span class="sg-meta-date">Обновлено: ${date}</span>

        <span class="sg-meta-item" data-tooltip="Примерное время чтения">
          ⏱ <span>${readTime} мин</span>
        </span>

        <span class="sg-meta-item" data-tooltip="Количество просмотров: ${views}">
          👁 <span>${views}</span>
        </span>

        <span class="sg-meta-item" data-tooltip="Количество лайков: ${likes}">
          ❤️ <span>${likes}</span>
        </span>
      </div>
    `;
  }

  function renderDown(box, views, likes, isLiked){
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(document.title || '');

    box.innerHTML = `
      <div class="sg-down-wrap">
        <div class="sg-down-item" data-tooltip="Количество просмотров: ${views}">
          👁 <span>${views}</span>
        </div>

       <div class="sg-article-share-placeholder"></div>

        <button
          class="sg-down-like sg-like-btn ${isLiked ? 'is-liked' : ''}"
          type="button"
          data-tooltip="Количество лайков: ${likes}">
          ${isLiked ? '❤️' : '♡'}
          <span>${likes}</span>
        </button>
      </div>
    `;
  }

  function initShareMenus(){
    document.querySelectorAll('.sg-down-share').forEach(function(share){
      share.addEventListener('click', function(e){
        e.stopPropagation();
        share.classList.toggle('open');
      });
    });

    document.querySelectorAll('.sg-copy-link').forEach(function(link){
      link.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();

        navigator.clipboard.writeText(window.location.href);

        link.textContent = 'Ссылка скопирована';

        setTimeout(function(){
          link.textContent = 'Скопировать ссылку';
        }, 1500);
      });
    });

    document.addEventListener('click', function(){
      document.querySelectorAll('.sg-down-share.open').forEach(function(el){
        el.classList.remove('open');
      });
    });
  }

  function initMobileTooltips(){
    document.addEventListener('click', function(e){
      const el = e.target.closest('[data-tooltip]');

      if(!el) return;
      if(window.innerWidth > 640) return;

      e.preventDefault();
      e.stopPropagation();

      document.querySelectorAll('.sg-mobile-tip').forEach(function(t){
        t.remove();
      });

      const tip = document.createElement('div');
      tip.className = 'sg-mobile-tip';
      tip.innerHTML = el.dataset.tooltip;

      document.body.appendChild(tip);

      const rect = el.getBoundingClientRect();

      tip.style.left = (rect.left + rect.width / 2) + 'px';
      tip.style.top = (window.scrollY + rect.top - 42) + 'px';

      setTimeout(function(){
        tip.remove();
      }, 2000);
    });
  }

  function initArticleLikes(){
    if(!isArticlePage()) return;

    const upBoxes = document.querySelectorAll('.uc-like-up');
    const downBoxes = document.querySelectorAll('.uc-like-down');

    if(!upBoxes.length && !downBoxes.length) return;

    injectCss();
    initMobileTooltips();



    loadSupabase(function(){
      const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

      const articleKey = window.location.pathname.replace(/\/$/, '') || '/';
      const articleTitle = document.title || articleKey;
      const likeStorage = 'sg-liked-' + articleKey;
      const readTime = getReadingTime(articleKey);

sb.rpc('increment_article_view_daily', {
  p_article_key: articleKey,
  p_title: articleTitle
}).then(function(dailyRes){
  if(dailyRes.error){
    console.log('Supabase daily view error:', dailyRes.error);
  }
});

sb.rpc('increment_article_view', {
  p_article_key: articleKey,
  p_title: articleTitle
}).then(function(res){

        if(res.error){
          console.log('Supabase view error:', res.error);
          return;
        }

        const row = Array.isArray(res.data) ? res.data[0] : res.data;

        const views = formatNumber(row.result_views);
        const likes = formatNumber(row.result_likes);

        const date = row.result_first_view_at
          ? new Date(row.result_first_view_at).toLocaleDateString('ru-RU')
          : new Date().toLocaleDateString('ru-RU');

        const isLiked = !!localStorage.getItem(likeStorage);

        upBoxes.forEach(function(box){
          renderUp(box, views, likes, date, isLiked, readTime);
        });

      downBoxes.forEach(function(box){
        renderDown(box, views, likes, isLiked);

        var placeholder = box.querySelector('.sg-article-share-placeholder');

        if (placeholder && window.SG && window.SG.share) {
        var shareBox = window.SG.share.create({
        title: document.title || articleTitle,
        text: document.title || articleTitle,
        url: window.location.href,
        buttonText: 'Поделиться',
      className: 'sg-share-box sg-article-share-box'
    });

      placeholder.replaceWith(shareBox);
    }
  });

       

        document.querySelectorAll('.sg-like-btn').forEach(function(btn){
          btn.addEventListener('click', function(e){
            e.preventDefault();
            e.stopPropagation();

            if(localStorage.getItem(likeStorage)) return;

            sb.rpc('like_article', {
              p_article_key: articleKey
            }).then(function(likeRes){

              if(likeRes.error){
                console.log('Supabase like error:', likeRes.error);
                return;
              }

              const likeRow = Array.isArray(likeRes.data) ? likeRes.data[0] : likeRes.data;
              const newLikes = formatNumber(likeRow.result_likes);

              document.querySelectorAll('.sg-like-btn').forEach(function(b){
                b.classList.add('is-liked');

                const span = b.querySelector('span');
                if(span) span.textContent = newLikes;
              });

              localStorage.setItem(likeStorage, '1');
            });
          });
        });
      });
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initArticleLikes);
  }else{
    initArticleLikes();
  }

})();