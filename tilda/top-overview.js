(function(){
  var currentPeriod = 'week';
  var pendingRequest;
  var requestTimeoutMs = 5000;
  var endpoint = '__SG_SUPABASE_URL__/rest/v1/rpc/get_public_top_snapshot';
  var publicKey = '__SG_SUPABASE_PUBLIC_KEY__';

  var PERIOD_NAMES = {
    today: 'сегодня',
    yesterday: 'вчера',
    week: 'за неделю',
    month: 'за месяц',
    quarter: 'за квартал'
  };

  function escapeHtml(text){
    return String(text || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function renderPeriodInfo(){
    var box = document.getElementById('sgTopPeriodInfo');
    if(!box) return;

    box.innerHTML = 'Показываем подборки <b>' + (PERIOD_NAMES[currentPeriod] || '') + '</b>. Обновления раз в час.';
  }

  function renderLists(lists){
    var box = document.getElementById('sgTopLists');
    if(!box) return;

    if(!lists || !lists.length){
      box.innerHTML = '<div class="sg-top-empty">Рейтинги пока формируются.</div>';
      return;
    }

    var html = '';

    lists.forEach(function(list){
      var items = list.items || [];
      if(!items.length) return;

      html +=
        '<section class="sg-top-section">' +
          '<div class="sg-top-section-head">' +
            '<div>' +
              '<h2>' + escapeHtml(list.icon || '🏆') + ' ' + escapeHtml(list.title || 'Рейтинг SweetGift') + '</h2>' +
              '<p>' + escapeHtml(list.description || '') + '</p>' +
            '</div>' +
            '<a class="sg-top-all" href="' + escapeHtml(list.url || '#') + '">Открыть список</a>' +
          '</div>' +
          '<div class="sg-top-grid">';

      items.forEach(function(item){
        var title = escapeHtml(item.product_title || 'Подарок SweetGift');
        var url = escapeHtml(item.product_key || '#');
        var image = escapeHtml(item.product_image || '');

        html +=
          '<a class="sg-top-card" href="' + url + '" title="' + title + '">' +
            '<div class="sg-top-img">' +
              (image ? '<img loading="lazy" decoding="async" src="' + image + '" alt="' + title + '" title="' + title + '">' : '') +
            '</div>' +
            '<div class="sg-top-card-body">' +
              '<div class="sg-top-badge">В рейтинге SweetGift</div>' +
              '<div class="sg-top-title">' + title + '</div>' +
            '</div>' +
          '</a>';
      });

      html +=
          '</div>' +
        '</section>';
    });

    box.innerHTML = html || '<div class="sg-top-empty">За выбранный период рейтинги пока формируются.</div>';
  }

  function loadData(){
    var box = document.getElementById('sgTopLists');
    if(!box) return;

    if(pendingRequest) pendingRequest.abort();
    var controller = new AbortController();
    pendingRequest = controller;
    var query = '?p_period=' + encodeURIComponent(currentPeriod) +
      '&apikey=' + encodeURIComponent(publicKey);
    var timer = setTimeout(function(){ controller.abort(); }, requestTimeoutMs);

    box.innerHTML = '<div class="sg-top-loading">Загрузка...</div>';
    renderPeriodInfo();

    fetch(endpoint + query, { signal: controller.signal })
      .then(function(response){
        if(!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function(data){
        if(!Array.isArray(data)) throw new Error('Invalid ranking response');
        if(pendingRequest === controller) renderLists(data);
      })
      .catch(function(error){
        if(pendingRequest !== controller) return;
        console.warn('[SG Top Page]', error);
        box.innerHTML = '<div class="sg-top-empty">Не удалось загрузить рейтинги. Выберите период ещё раз.</div>';
      })
      .finally(function(){
        clearTimeout(timer);
        if(pendingRequest === controller) pendingRequest = null;
      });
  }

  function init(){
    document.querySelectorAll('.sg-top-period-tabs button').forEach(function(btn){
      btn.addEventListener('click', function(){
        currentPeriod = btn.getAttribute('data-period') || 'week';

        document.querySelectorAll('.sg-top-period-tabs button').forEach(function(b){
          b.classList.remove('is-active');
        });

        btn.classList.add('is-active');
        loadData();
      });
    });

    loadData();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
