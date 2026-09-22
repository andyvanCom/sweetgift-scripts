/* Generated from packages/gift-quiz-core/src/index.js. Do not edit. */
(function(global){'use strict';
const QUIZ_CORE_VERSION = '1.0.0';
const BUDGET = Object.freeze({ min: 2190, max: 98500, step: 10 });

const giftTypeMedia = Object.freeze({
  basket: [
    'https://static.tildacdn.com/stor6363-6634-4234-b531-616361306466/97995128.jpg',
    'https://static.tildacdn.com/stor3363-3438-4164-a431-386165353230/73486475.jpg',
    'https://static.tildacdn.com/stor3862-3035-4139-b033-366263663135/c0eeabec31197e7485518c67c08d1483.jpg',
  ],
  box: [
    'https://static.tildacdn.com/stor3236-6530-4463-a136-666535363237/70337838.jpg',
    'https://static.tildacdn.com/stor6465-3561-4730-b962-613666323164/71186449.jpg',
    'https://static.tildacdn.com/stor6434-3532-4566-b432-393133313633/840c4dc187e7b67860c96ccb40041016.jpg',
  ],
  strawberry: [
    'https://static.tildacdn.com/stor3234-3931-4535-a130-343830353738/35313080.jpg',
    'https://static.tildacdn.com/stor6136-3735-4338-b239-303835386232/92763766.jpg',
    'https://static.tildacdn.com/stor6561-6133-4636-b637-633239303339/32873548.jpg',
  ],
});

const option = (value, label) => Object.freeze({ value, label });
const when = (key, values) => Object.freeze({ key, includesAny: values });

const quizQuestions = Object.freeze([
  { key:'gift_type', title:'Что вас интересует?', type:'single', required:true, options:[option('basket','Подарочная корзина'),option('box','Подарочный бокс или ящик'),option('strawberry','Клубника и фрукты в шоколаде')], help:'Сначала выберите направление — дальше покажем только подходящие вопросы.', resetAllOnChange:true },
  { key:'strawberry_format', title:'Как оформить клубнику или фрукты?', type:'single', required:false, skipValue:'any', options:[option('box','В коробочке'),option('bouquet','В виде букета'),option('any','Покажите оба варианта')], visibleWhen:when('gift_type',['strawberry']) },
  { key:'flowers', title:'Нужно добавить живые цветы?', type:'single', required:false, skipValue:'any', options:[option('with_flowers','Да, клубника и цветы'),option('without_flowers','Нет, только ягоды и шоколад'),option('any','Рассмотреть оба варианта')], visibleWhen:{ all:[when('gift_type',['strawberry']),{key:'strawberry_format',notEquals:'box'}] } },
  { key:'recipient', title:'Кому выбираем подарок?', type:'multiple', required:true, options:[option('man','Мужчине'),option('woman','Женщине'),option('child','Ребёнку'),option('manager','Руководителю'),option('colleague','Коллеге'),option('partner','Партнёру / клиенту'),option('family','Семье'),option('employees','Сотрудникам / нескольким людям')], help:'Можно выбрать несколько вариантов, например «Мужчине» и «Руководителю».' },
  { key:'child_age', title:'Сколько лет?', type:'single', required:false, skipValue:'any', options:[option('3-6','3–6'),option('7-10','7–10'),option('11-14','11–14'),option('15-17','15–17'),option('any','Неважно')], visibleWhen:when('recipient',['child']) },
  { key:'child_gender', title:'Для кого подарок?', type:'single', required:false, skipValue:'any', options:[option('boy','Мальчик'),option('girl','Девочка'),option('any','Неважно')], visibleWhen:when('recipient',['child']) },
  { key:'manager_gender', title:'Руководитель — мужчина или женщина?', type:'single', required:false, skipValue:'any', options:[option('man','Мужчина'),option('woman','Женщина'),option('any','Неважно')], visibleWhen:when('recipient',['manager']) },
  { key:'budget', title:'На какой бюджет рассчитываете?', type:'budget', required:false, skipValue:{budget:'range',budget_min:String(BUDGET.min),budget_max:String(BUDGET.max)}, options:[], help:'Передвиньте левую и правую точки, чтобы задать диапазон цены.' },
  { key:'style', title:'Какой подарок вам больше нравится?', type:'single', required:false, skipValue:'best', options:[option('sweet','Яркий и сладкий'),option('fruit','Свежий фруктовый'),option('gourmet','Гастрономический'),option('tea','Чай, кофе и сладости'),option('hearty','Сытный, с деликатесами'),option('premium','Премиальный / статусный'),option('best','Покажите лучшее')], visibleWhen:when('gift_type',['basket','box']) },
  { key:'ingredients', title:'Что обязательно должно быть в составе?', type:'multiple', required:false, skipValue:['none'], exclusiveValues:['none'], options:[['cheese','Сыр'],['sausage','Колбаса'],['meat','Мясные деликатесы'],['ikra','Икра'],['crab','Краб'],['salmon','Лосось'],['coffee','Кофе'],['tea','Чай'],['honey','Мёд'],['орехи','Орехи'],['chocolate','Шоколад'],['candies','Конфеты'],['cookies','Печенье'],['jam','Джем'],['olives','Оливки'],['pineapple','Ананас'],['grapes','Виноград'],['apples','Яблоки'],['mandarins','Мандарины'],['bananas','Бананы'],['kiwi','Киви'],['strawberry','Клубника'],['raspberry','Малина'],['blackberry','Ежевика'],['pitahaya','Питахайя'],['papaya','Папайя'],['nectarines','Нектарины'],['bear','Медвежатина'],['deer','Оленина'],['none','Состав не важен']].map(([value,label])=>option(value,label)), help:'Можно выбрать несколько ингредиентов. В результат попадут только подарки, где есть всё выбранное.', visibleWhen:when('gift_type',['basket','box']) },
  { key:'timing', title:'Когда подарок будут вручать?', type:'single', required:false, skipValue:'unknown', options:[option('now','Сразу / в течение нескольких часов'),option('today','В этот же день'),option('tomorrow','На следующий день'),option('longer','Возможно, придётся хранить дольше'),option('unknown','Не знаю')] },
  { key:'diet', title:'Есть важные ограничения?', type:'multiple', required:false, skipValue:['none'], exclusiveValues:['none'], options:[option('no_pork','Без свинины'),option('vegetarian','Для вегетарианца — без мяса и рыбы'),option('no_sweet','Без сладкого'),option('no_dairy','Без молочных продуктов'),option('none','Нет ограничений')], visibleWhen:when('gift_type',['basket','box']) },
].map(question=>Object.freeze({...question,options:Object.freeze(question.options)})));

const legacyBudgets={under_5000:[BUDGET.min,5000],'5000_7000':[5000,7000],'7000_10000':[7000,10000],'10000_15000':[10000,15000],over_15000:[15000,BUDGET.max],any:[BUDGET.min,BUDGET.max]};
const questionByKey=new Map(quizQuestions.map(question=>[question.key,question]));

function hasAnswer(answers,key,value){const answer=answers?.[key];return Array.isArray(answer)?answer.includes(value):answer===value;}
function matches(rule,answers){if(!rule)return true;if(rule.all)return rule.all.every(item=>matches(item,answers));if(rule.any)return rule.any.some(item=>matches(item,answers));const answer=answers[rule.key];if(rule.notEquals!==undefined)return answer!==rule.notEquals;return (rule.includesAny||[]).some(value=>Array.isArray(answer)?answer.includes(value):answer===value);}
function isQuestionVisible(question,answers){return matches(question.visibleWhen,answers||{});}
function getVisibleQuestions(answers){return quizQuestions.filter(question=>isQuestionVisible(question,answers));}
function isAnswered(answers,key){const value=answers?.[key];return Array.isArray(value)?value.length>0:value!==undefined&&value!==null&&value!=='';}

function clampBudget(value,fallback){const parsed=Number(value);if(!Number.isFinite(parsed))return fallback;return Math.min(BUDGET.max,Math.max(BUDGET.min,Math.round(parsed/BUDGET.step)*BUDGET.step));}
function validValue(question,value){return question.options.some(option=>option.value===value);}
function normalizeAnswers(input={}){
  const source=input&&typeof input==='object'?input:{},answers={};
  for(const question of quizQuestions){
    let value=source[question.key];
    if(question.key==='recipient'&&typeof value==='string')value=[value];
    if(question.type==='multiple'){
      const values=(Array.isArray(value)?value:typeof value==='string'?[value]:[]).filter(item=>typeof item==='string'&&validValue(question,item));
      if(values.length)answers[question.key]=[...new Set(values)];
    }else if(question.type!=='budget'&&typeof value==='string'&&validValue(question,value))answers[question.key]=value;
  }
  if(!answers.diet&&source.pork==='no_pork')answers.diet=['no_pork'];
  const legacy=legacyBudgets[source.budget];
  if(source.budget==='range'||legacy){
    let minimum=clampBudget(source.budget_min,legacy?.[0]??BUDGET.min),maximum=clampBudget(source.budget_max,legacy?.[1]??BUDGET.max);
    if(maximum-minimum<BUDGET.step)maximum=Math.min(BUDGET.max,minimum+BUDGET.step);
    if(maximum-minimum<BUDGET.step)minimum=Math.max(BUDGET.min,maximum-BUDGET.step);
    Object.assign(answers,{budget:'range',budget_min:String(minimum),budget_max:String(maximum)});
  }
  return cleanHiddenAnswers(answers);
}

function cleanHiddenAnswers(input){const answers={...input};let changed=true;while(changed){changed=false;for(const question of quizQuestions){if(!isQuestionVisible(question,answers)&&isAnswered(answers,question.key)){delete answers[question.key];if(question.key==='budget'){delete answers.budget_min;delete answers.budget_max;}changed=true;}}}return answers;}

function applyAnswer(input,key,value){const question=questionByKey.get(key);if(!question)return normalizeAnswers(input);if(question.resetAllOnChange&&input?.[key]!==value)return normalizeAnswers({[key]:value});const answers={...normalizeAnswers(input)};if(question.type==='budget'){let minimum=clampBudget(value?.minimum??value?.min??answers.budget_min,BUDGET.min),maximum=clampBudget(value?.maximum??value?.max??answers.budget_max,BUDGET.max);if(maximum-minimum<BUDGET.step){if(minimum+BUDGET.step<=BUDGET.max)maximum=minimum+BUDGET.step;else minimum=maximum-BUDGET.step;}answers.budget='range';answers.budget_min=String(minimum);answers.budget_max=String(maximum);}else if(question.type==='multiple'){
    const current=Array.isArray(answers[key])?[...answers[key]]:[],exclusive=question.exclusiveValues||[];
    if(exclusive.includes(value))answers[key]=[value];else{const clean=current.filter(item=>!exclusive.includes(item)),index=clean.indexOf(value);if(index>=0)clean.splice(index,1);else if(validValue(question,value))clean.push(value);if(clean.length)answers[key]=clean;else delete answers[key];}
  }else if(validValue(question,value))answers[key]=value;return cleanHiddenAnswers(answers);}

function skipQuestion(input,key){const question=questionByKey.get(key);if(!question||question.required||question.skipValue===undefined)return normalizeAnswers(input);if(question.type==='budget')return cleanHiddenAnswers({...normalizeAnswers(input),...question.skipValue});const skipValue=Array.isArray(question.skipValue)?[...question.skipValue]:question.skipValue;return cleanHiddenAnswers({...normalizeAnswers(input),[key]:skipValue});}
function clearAnswer(input,key){const answers={...normalizeAnswers(input)};delete answers[key];if(key==='budget'){delete answers.budget_min;delete answers.budget_max;}return cleanHiddenAnswers(answers);}
function getQuizProgress(answers,editingKey=''){const visible=getVisibleQuestions(answers),answered=visible.filter(question=>isAnswered(answers,question.key)).length-(editingKey&&isAnswered(answers,editingKey)?1:0),nextIndex=editingKey?visible.findIndex(question=>question.key===editingKey):visible.findIndex(question=>!isAnswered(answers,question.key)),currentIndex=nextIndex<0?Math.max(0,visible.length-1):nextIndex,completed=Math.max(0,Math.min(answered,visible.length));return{current:visible.length?Math.min(visible.length,currentIndex+1):0,total:visible.length,completed,remaining:Math.max(0,visible.length-completed),percent:visible.length?Math.round(completed/visible.length*100):0,complete:visible.every(question=>isAnswered(answers,question.key)||!question.required)};}
function getAnswerLabel(answers,key){const question=questionByKey.get(key);if(!question)return '';if(key==='budget'&&answers.budget==='range')return `от ${answers.budget_min||BUDGET.min} до ${answers.budget_max||BUDGET.max}`;const values=Array.isArray(answers[key])?answers[key]:[answers[key]];return values.filter(Boolean).map(value=>question.options.find(option=>option.value===value)?.label||value).join(', ');}
function readQuizUrl(value){const params=value instanceof URLSearchParams?value:new URL(String(value),'https://sweetgift.ru').searchParams,raw={};for(const question of quizQuestions){const value=params.get(question.key);if(value)raw[question.key]=question.type==='multiple'?value.split(','):value;}for(const key of ['budget_min','budget_max']){const value=params.get(key);if(value)raw[key]=value;}const pork=params.get('pork');if(pork)raw.pork=pork;const answers=normalizeAnswers(raw);return{answers,found:Object.keys(answers).length>0};}
function writeQuizUrl(value,input){const url=value instanceof URL?new URL(value.href):new URL(String(value),'https://sweetgift.ru'),answers=normalizeAnswers(input);for(const question of quizQuestions){const value=answers[question.key];if(isAnswered(answers,question.key))url.searchParams.set(question.key,Array.isArray(value)?value.join(','):String(value));else url.searchParams.delete(question.key);}for(const key of ['budget_min','budget_max']){if(answers[key])url.searchParams.set(key,String(answers[key]));else url.searchParams.delete(key);}url.searchParams.delete('pork');return url;}
function toSupabaseAnswers(input){const answers=normalizeAnswers(input),allowed=new Set([...quizQuestions.map(question=>question.key),'budget_min','budget_max']);return Object.fromEntries(Object.entries(answers).filter(([key,value])=>allowed.has(key)&&(typeof value==='string'||Array.isArray(value)&&value.every(item=>typeof item==='string'))));}

global.SweetGiftQuizCore=Object.freeze({QUIZ_CORE_VERSION,BUDGET,giftTypeMedia,quizQuestions,hasAnswer,isQuestionVisible,getVisibleQuestions,isAnswered,normalizeAnswers,cleanHiddenAnswers,applyAnswer,skipQuestion,clearAnswer,getQuizProgress,getAnswerLabel,readQuizUrl,writeQuizUrl,toSupabaseAnswers});
})(typeof window!=='undefined'?window:globalThis);

