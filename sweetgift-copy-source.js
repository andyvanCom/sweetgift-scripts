/*
===========================================================================
SweetGift.ru | Copy Source
---------------------------------------------------------------------------
Добавляет ссылку на источник при копировании текстового контента.
===========================================================================
*/

(function () {
  'use strict';

  window.SG = window.SG || {};

  var VERSION = '1';

  window.SG.copySource = {
    version: VERSION
  };

  var CONFIG = {
    minLength: 80,
    siteName: 'SweetGift.ru',
    copyrightText: '© Сладкие подарки SweetGift.ru'
  };

  function cleanText(text) {
    return String(text || '')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function shouldSkip(target) {
    if (!target) return false;

    return !!target.closest(
      'input, textarea, select, [contenteditable="true"], .t-input, .t-form'
    );
  }

  function getSelectedText() {
    var selection = window.getSelection && window.getSelection();

    if (!selection || selection.rangeCount === 0) return '';

    return cleanText(selection.toString());
  }

  function buildSourceText(originalText) {
    var url = window.location.href.split('#')[0];

    return originalText +
      '\n\nИсточник: ' + url +
      '\n' + CONFIG.copyrightText;
  }

  function onCopy(event) {
    if (shouldSkip(event.target)) return;

    var selectedText = getSelectedText();

    if (!selectedText || selectedText.length < CONFIG.minLength) return;

    var finalText = buildSourceText(selectedText);

    if (event.clipboardData) {
      event.clipboardData.setData('text/plain', finalText);
      event.preventDefault();
      return;
    }

    if (window.clipboardData) {
      window.clipboardData.setData('Text', finalText);
      event.preventDefault();
    }
  }

  document.addEventListener('copy', onCopy);
})();