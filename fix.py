import codecs
import re

with codecs.open(r'd:\Study\self\projects\hangman\public\app.js', 'r', 'utf-8') as f:
    text = f.read()

target = """      const card = document.createElement('div');
      card.className = 'lobby-player-card glass';
      card.innerHTML = `
      let kickBtnHTML = '';
      if (isOwner && p.name !== playerName) {
         kickBtnHTML = `<button class="btn-kick-inline" data-name="${p.name}" title="Kick ${p.name}">❌</button>`;
      }
      card.innerHTML = `
        <div class="lp-avatar">${p.role === 'setter' ? '👑' : '👤'}</div>
        <div class="lp-info">
          <span class="lp-name">${p.name} ${p.name === playerName ? '(You)' : ''}</span>
          <span class="lp-status ${p.connected ? 'connected' : 'waiting'}">${p.connected ? t('connected') : t('waiting')}</span>
        </div>
        ${kickBtnHTML}
      `;
      container.appendChild(card);"""

replacement = """      const card = document.createElement('div');
      card.className = 'lobby-player-card glass';
      
      let kickBtnHTML = '';
      if (isOwner && p.name !== playerName) {
         kickBtnHTML = `<button class="btn-kick-inline" data-name="${p.name}" title="Kick ${p.name}">❌</button>`;
      }
      
      card.innerHTML = `
        <div class="lp-avatar">${p.role === 'setter' ? '👑' : '👤'}</div>
        <div class="lp-info">
          <span class="lp-name">${p.name} ${p.name === playerName ? '(You)' : ''}</span>
          <span class="lp-status ${p.connected ? 'connected' : 'waiting'}">${p.connected ? t('connected') : t('waiting')}</span>
        </div>
        ${kickBtnHTML}
      `;
      container.appendChild(card);"""

def escape_regex(s):
    return s.replace('\\', '\\\\').replace('+', '\\+').replace('*', '\\*').replace('?', '\\?').replace('[', '\\[').replace(']', '\\]').replace('(', '\\(').replace(')', '\\)').replace('{', '\\{').replace('}', '\\}').replace('^', '\\^').replace('$', '\\$').replace('.', '\\.').replace('|', '\\|')

pattern_str = escape_regex(target).replace('\n', r'\r?\n')

text = re.sub(pattern_str, replacement, text)

with codecs.open(r'd:\Study\self\projects\hangman\public\app.js', 'w', 'utf-8') as f:
    f.write(text)
