import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with telemetry header as required
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Dynamic AI client provider checking request headers for user-provided API key
function getAiClient(req: express.Request): GoogleGenAI {
  const userApiKey = req.headers["x-user-api-key"] as string || req.headers["X-User-Api-Key"] as string;
  if (userApiKey && userApiKey.trim() !== "") {
    return new GoogleGenAI({
      apiKey: userApiKey.trim(),
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return ai;
}

// Helper function to handle generation with a fallback mechanism to other models in case of quota exhaustion
async function generateContentWithFallback(ai: GoogleGenAI, options: {
  contents: any;
  config?: any;
  models?: string[];
}) {
  const models = options.models || ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`[Gemini SDK] Attempting generation with model: ${model}`);
      const response = await ai.models.generateContent({
        model: model,
        contents: options.contents,
        config: options.config,
      });
      console.log(`[Gemini SDK] Success with model: ${model}`);
      return response;
    } catch (error: any) {
      console.warn(`[Gemini SDK] Handled non-fatal error with model ${model} (trying next fallback):`, error.message || error);
      lastError = error;
      // Continue to next model on fallback list
    }
  }
  console.error(`[Gemini SDK] All models in fallback chain failed. Last error:`, lastError.message || lastError);
  throw lastError;
}

// Helper function to handle text generation using either default Gemini or a custom OpenAI-compatible provider
async function generateAIContent(req: express.Request, options: {
  prompt: string;
  systemInstruction: string;
  temperature?: number;
  responseSchema?: any;
}) {
  const customProvider = req.headers["x-custom-provider"] as string;
  const customUrl = req.headers["x-custom-provider-url"] as string;
  const customModel = req.headers["x-custom-provider-model"] as string;
  const userApiKey = req.headers["x-user-api-key"] as string || req.headers["X-User-Api-Key"] as string;

  if (customUrl && customUrl.trim() !== "") {
    let baseUrl = customUrl.trim();
    if (!baseUrl.endsWith("/chat/completions") && !baseUrl.endsWith("/chat/completions/")) {
      baseUrl = baseUrl.replace(/\/$/, "") + "/chat/completions";
    }

    const modelName = customModel?.trim() || "deepseek-chat";
    const apiKey = userApiKey?.trim() || "";

    console.log(`[Custom Provider] Routing request to ${baseUrl} using model ${modelName}`);

    let finalPrompt = options.prompt;
    if (options.responseSchema) {
      finalPrompt += `\n\nIMPORTANT: You MUST respond ONLY with a raw JSON object (with no other text, or inside a markdown \`\`\`json block) that strictly conforms to this JSON Schema:\n${JSON.stringify(options.responseSchema)}`;
    }

    const messages = [
      { role: "system", content: options.systemInstruction },
      { role: "user", content: finalPrompt }
    ];

    const body: any = {
      model: modelName,
      messages: messages,
      temperature: options.temperature !== undefined ? options.temperature : 1.0,
    };

    // If schema is requested, we try json_object format (standard for OpenAI-compat APIs)
    if (options.responseSchema) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Custom Provider] Error response:`, errorText);
      throw new Error(`Ошибка провайдера API (Статус ${response.status}): ${errorText}`);
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content || "";

    // Clean markdown code block if present
    text = text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
    }

    return { text };
  }

  // Fallback to default Gemini
  const aiClient = getAiClient(req);
  const response = await generateContentWithFallback(aiClient, {
    contents: options.prompt,
    config: {
      systemInstruction: options.systemInstruction,
      temperature: options.temperature !== undefined ? options.temperature : 1.0,
      ...(options.responseSchema ? {
        responseMimeType: "application/json",
        responseSchema: options.responseSchema,
      } : {})
    },
  });

  return response;
}

// Function to translate raw Gemini API / network errors into extremely polished, helpful, localized Russian error messages.
function getReadableAIError(error: any): string {
  if (!error) return "Неизвестная ошибка ИИ";
  
  const errStr = typeof error === "object" ? JSON.stringify(error) : String(error);
  
  if (
    errStr.includes("RESOURCE_EXHAUSTED") || 
    errStr.includes("quota") || 
    errStr.includes("429") || 
    error.status === 429 ||
    (error.message && (error.message.includes("quota") || error.message.includes("limit") || error.message.includes("429")))
  ) {
    return "Превышена квота бесплатных запросов к API Gemini (Rate Limit Exceeded). Пожалуйста, подождите 1 минуту перед повторным запросом или подключите собственный ключ API в настройках AI Studio.";
  }
  
  if (errStr.includes("API_KEY_INVALID") || errStr.includes("invalid api key") || errStr.includes("API key not valid")) {
    return "Указан недействительный API-ключ Gemini. Пожалуйста, проверьте и обновите ваш API-ключ в настройках Secrets.";
  }

  if (errStr.includes("SAFETY") || errStr.includes("blocked by safety")) {
    return "Генерация отклонена фильтрами безопасности AI (запрос содержит чувствительные или небезопасные темы). Попробуйте изменить описание или ключевые слова.";
  }
  
  return error.message || String(error);
}

// API Route for GURPS Mutation generation with multiple filters and custom wishes
app.post("/api/generate-mutation", async (req, res) => {
  try {
    const { 
      positiveTarget = 30, 
      negativeTarget = -15, 
      themes = [], 
      types = [], 
      complexities = [], 
      wishes = "", 
      exclude = [],
      count = 1,
      bodySystem = "",
      bodySystems = []
    } = req.body;

    const finalThemes = themes.length > 0 ? themes : [req.body.theme || "Любая"];
    const themesStr = finalThemes.join(", ");
    const typesStr = types.length > 0 ? types.join(", ") : "Любой";
    const complexitiesStr = complexities.length > 0 ? complexities.join(", ") : "Любая";
    const excludeListStr = exclude.length > 0 ? exclude.join(", ") : "нет";
    const numToGenerate = Math.min(Math.max(parseInt(count as any, 10) || 1, 1), 10);

    let bodySystemPromptStr = "";
    if (numToGenerate > 1) {
      if (Array.isArray(bodySystems) && bodySystems.length > 0) {
        bodySystemPromptStr = `4. Изменяемые части или системы тела для КАЖДОЙ из ${numToGenerate} мутаций по порядку:\n`;
        for (let i = 0; i < numToGenerate; i++) {
          const sys = bodySystems[i] || bodySystems[0] || "Случайная";
          bodySystemPromptStr += `   - Мутация №${i + 1} ДОЛЖНА затронуть именно: "${sys}"\n`;
        }
      } else if (bodySystem) {
        bodySystemPromptStr = `4. Изменяемая часть или система тела (ВСЕ ${numToGenerate} мутаций ДОЛЖНЫ затронуть именно её): ${bodySystem}`;
      }
    } else {
      bodySystemPromptStr = bodySystem ? `4. Изменяемая часть или система тела (мутация ДОЛЖНА затронуть именно её): ${bodySystem}` : "";
    }

    let step1PromptStr = "";
    if (numToGenerate > 1 && Array.isArray(bodySystems) && bodySystems.length > 0) {
      step1PromptStr = `Придумай яркие художественные идеи для каждой из ${numToGenerate} мутаций с подробным описанием внешнего вида, ощущений и биологических изменений (на русском языке), полностью учитывая пожелания пользователя: "${wishes}". Каждая i-я мутация ДОЛЖНА затронуть соответствующую систему тела / орган из списка выше (Мутация №1 -> "${bodySystems[0]}", Мутация №2 -> "${bodySystems[1] || bodySystems[0]}", и т.д.). Каждая из мутаций должна иметь в поле "bodySystem" соответствующую систему тела.`;
    } else {
      step1PromptStr = `Придумай яркую художественную идею мутации с подробным описанием внешнего вида, ощущений и биологических изменений (на русском языке), полностью учитывая пожелания пользователя: "${wishes}". ${bodySystem ? `Обязательно сделай так, чтобы мутация повлияла именно на указанную систему тела / орган: "${bodySystem}".` : ""}`;
    }

    const prompt = `Сгенерируй ${numToGenerate === 1 ? 'ОДНУ уникальную, интересную и сбалансированную мутацию' : `СПИСОК ИЗ ${numToGenerate} уникальных, интересных и сбалансированных мутаций`} для настольной ролевой игры GURPS 4-й редакции (GURPS 4e) по следующим критериям.

Параметры генерации:
1. Выбранные генетические классы (тематика): ${themesStr} (например: Биологическая, Радиационная, Псионическая, Кибернетическая, Магическая, Космическая).
2. Тип эффекта: ${typesStr} (например: Физический, Ментальный).
3. Сложность / Масштаб: ${complexitiesStr} (например: Минорной, Мажорной, Экстремальной).
${bodySystemPromptStr}
5. Особые пожелания пользователя (направление мутации, детали внешнего вида, способности): ${wishes ? `"${wishes}"` : "нет специальных пожеланий"}.
6. Желаемый уровень преимуществ (положительные очки) на одну мутацию: около ${positiveTarget} очков.
7. Желаемый уровень недостатков (отрицательные очки) на одну мутацию: около ${negativeTarget} очков (это отрицательное число, например, -15).
8. ИСКЛЮЧИТЬ ИЗ ГЕНЕРАЦИИ (не повторять концепции, идеи, названия или схожие свойства!): ${excludeListStr}. Крайне важно, чтобы новые мутации кардинально отличались по своей сути и механике от этих уже существующих!

Процесс генерации:
Шаг 1: ${step1PromptStr}
Шаг 2: Переведи эту художественную идею на строгий язык правил GURPS 4-й редакции.
- Подбери Одно или Несколько официальных Преимуществ (Advantages) GURPS, соответствующих идее, ИЗ СВЕРХМАКСИМАЛЬНОГО СПИСКА ПРЕИМУЩЕСТВ в системных инструкциях. Укажи их оригинальные английские названия. Наложи на них модификаторы (Улучшения / Ограничения, Enhancements / Limitations), чтобы подогнать под тему мутации (например, ограничение "Мутация, -10%", "Ограниченное использование", "Сниженная дистанция"). Рассчитай итоговую стоимость преимуществ так, чтобы сумма была близка к ${positiveTarget}.
- Подбери Одно или Несколько официальных Недостатков (Disadvantages), отражающих побочные эффекты мутации, ИЗ СВЕРХМАКСИМАЛЬНОГО СПИСКА НЕДОСТАТКОВ в системных инструкциях. Укажи их оригинальные английские названия. Рассчитай итоговую стоимость недостатков так, чтобы сумма была близка к ${negativeTarget}.

Рассчитывай очки строго по правилам GURPS (итоговая стоимость = базовая стоимость * (1 + сумма модификаторов в процентах), округляется в большую сторону, минимальная стоимость обычно 20% от базы). Постарайся сделать расчеты математически верными и правдоподобными для опытных игроков в GURPS.

Верни ответ в виде JSON, соответствующего заданной схеме.`;

    const systemInstruction = `Ты — эксперт по настольной ролевой системе GURPS 4-й редакции (GURPS 4e) и эксперт-дизайнер персонажей. Твоя задача — генерировать уникальные, детализированные и сбалансированные мутации.
Всегда пиши описание, названия преимуществ/недостатков и детали на РУССКОМ языке. Английские названия преимуществ/недостатков пиши в поле englishName.
Соблюдай математику начисления очков GURPS 4e. Положительные черты должны стремиться к указанному пользователем значению. Отрицательные черты должны стремиться к указанному пользователем отрицательному значению. Не используй названия мутаций из списка исключений.

ОФИЦИАЛЬНЫЙ СПИСОК ПРЕИМУЩЕСТВ (GURPS Advantages):
- Terrain Adaptation (Адаптация к поверхности) [0/5]
- Night Vision (Адаптация к темноте) [1/ур.]
- Amphibious (Амфибия) [10]
- Unkillable (Бессмертие) [50..150]
- Fearlessness (Бесстрашие) [2/ур.]
- Silence (Бесшумность) [5/ур.]
- Combat Reflexes (Боевые рефлексы) [15]
- Rapid Healing (Быстрое заживление) [5]
- Autotrance (Быстрый транс) [1]
- See Invisible (Видит невидимое) [15]
- Visualization (Визуализация) [10]
- Appearance (Внешность) [разл.]
- Affliction (Воздействие) [10/ур.]
- Recovery (Восстановление сознания) [10]
- High Manual Dexterity (Высокая ловкость рук) [5/ур.]
- High Pain Threshold (Высокий болевой порог) [10]
- Hermaphromorph (Гермафроморф) [5]
- Sealed (Герметичность) [15]
- Flexibility (Гибкость) [5]
- Hyperspectral Vision (Гиперспектральное зрение) [25]
- Obscure (Глушение) [2/ур.]
- Mana Damper (Глушитель маны) [10/ур.]
- Voice (Голос) [10]
- Clairsentience (Дальновидение) [50]
- Power Investiture (Дарованная сила) [10/ур.]
- Snatcher (Добытчик) [80]
- Longevity (Долгожитель) [2]
- Extra Attack (Дополнительная атака) [25/атака]
- Extra Head (Дополнительная голова) [15/голова]
- Extra Life (Дополнительная жизнь) [25/жизнь]
- Extra Legs (Дополнительные ноги) [разл.]
- Extra Arms (Дополнительные руки) [разл.]
- Extra Mouth (Дополнительный рот) [5/рот]
- Striker (Естественное оружие) [5..8]
- Breath-Holding (Задержка дыхания) [2/ур.]
- Protected Sense (Защищенное чувство) [5/орган]
- Common Sense (Здравый смысл) [10]
- Mind Probe (Зондирование разума) [20]
- Dark Vision (Зрение в темноте) [25]
- Teeth (Зубы) [0,1,2]
- Eidetic Memory (Идеальная память) [5]
- Perfect Balance (Идеальное равновесие) [15]
- Parabolic Hearing (Избирательный слух) [4/ур.]
- Modular Abilities (Изменяемые способности) [разл.]
- Gadgeteer (Изобретатель) [25/50]
- Intuition (Интуиция) [15]
- Subsonic Speech (Инфразвуковая речь) [0/10]
- Subsonic Hearing (Инфразвуковой слух) [0/5]
- Infravision (Инфразрение) [0/10]
- True Faith (Истинная вера) [15]
- Claws (Когти) [разл.]
- Digital Mind (Компьютерный разум) [5]
- Metabolism Control (Контроль метаболизма) [5/ур.]
- Mind Control (Контроль разума) [50]
- Temperature Control (Контроль температуры) [5/ур.]
- Deep Sleeper (Крепкий сон) [1]
- 360° Vision (Круговой обзор) [25]
- Xeno-Adaptability (Ксено-адаптация) [20]
- Healing (Лечение) [30]
- Magery (Магичность) [5+10/ур.]
- Less Sleep (Мало спит) [2/ур.]
- Fur (Мех) [1]
- Nictitating Membrane (Мигательные перепонки) [1/ур.]
- Microscopic Vision (Микроскопическое зрение) [5/ур.]
- Lightning Calculator (Молниеносные расчеты) [2]
- Catfall (Мягкое падение) [10]
- Doesn't Breathe (Не дышает) [20]
- Doesn't Eat or Drink (Не ест/не пьет) [10]
- Doesn't Sleep (Не спит) [20]
- Invisibility (Невидимость) [40]
- Unfazeable (Невозмутимость) [15]
- Discriminatory Smell (Необычное обоняние) [15]
- Discriminatory Taste (Необычный вкус) [10]
- Discriminatory Hearing (Необычный слух) [15]
- Unaging (Нестареющий) [15]
- Detect (Обнаружение) [разл.]
- Acute Vision (Обостренное зрение) [2/ур.]
- Acute Touch (Обостренное осязание) [2/ур.]
- Acute Taste and Smell (Обостренный вкус и обоняние) [2/ур.]
- Acute Hearing (Обостренный слух) [2/ур.]
- Ambidexterity (Обоюдорукость) [5]
- Speak With Animals (Общение с животными) [25]
- Speak With Plants (Общение с растениями) [15]
- Regrowth (Отращивание) [40]
- Very Rapid Healing (Очень быстрое заживление) [15]
- Very Fit (Очень спортивный) [15]
- Possession (Переселение) [100]
- Peripheral Vision (Периферийное зрение) [15]
- Mimicry (Подражание звукам) [10]
- Lifting ST (Подъемная сила) [3/ур.]
- Payload (Полезный груз) [1/ур.]
- Flight (Полет) [40]
- Morph (Полиморф) [разл.]
- Reduced Consumption (Пониженное потребление) [2/ур.]
- Shapeshifting (Превращение) [разл.]
- Precognition (Предвидение) [25]
- Clinging (Прилипание) [20]
- Innate Attack (Природная атака) [разл.]
- Tunneling (Прокладка туннелей) [30+5/ур.]
- Penetrating Voice (Пронзительный голос) [1]
- Penetrating Vision (Проникающее зрение) [10/ур.]
- Permeation (Проникновение) [разл.]
- Jumper (Прыгун) [100]
- Psychometry (Психометрия) [20]
- Speak Underwater (Разговор под водой) [5]
- Duplication (Разделение) [35/копия]
- Compartmentalized Mind (Раздельное сознание) [50/ур.]
- Stretching (Растягивание) [6/ур.]
- Regeneration (Регенерация) [разл.]
- Growth (Рост) [10/ур.]
- Supernatural Durability (Сверхъестественная живучесть) [150]
- Constriction Attack (Сдавливание) [15]
- Arm ST (Сила руки) [3.5,8/ур.]
- Scanning Sense (Сканирование) [разл.]
- Binding (Сковывание) [2/ур.]
- Slippery (Скользкий) [2/ур.]
- Serendipity (Совпадение) [15/ур.]
- Damage Resistance (Сопротивление повреждениям) [5/ур.]
- Daredevil (Сорвиголова) [15]
- Fit (Спортивный) [5]
- Gunslinger (Стрелок) [25]
- Super Climbing (Супер лазанье) [3/ур.]
- Super Jump (Супер прыжок) [10/ур.]
- Super Luck (Супер удача) [100]
- Telekinesis (Телекинез) [5/ур.]
- Telecommunication (Телекоммуникация) [разл.]
- Warp (Телепортация) [100]
- Telescopic Vision (Телескопическое зрение) [5/ур.]
- Shadow Form (Теневая форма) [50]
- Hard to Subdue (Трудно лишить сознания) [2/ур.]
- Hard to Kill (Трудно убить) [2/ур.]
- Altered Time Rate (Ускоренный ход времени) [100/ур.]
- Enhanced Move (Увеличенное движение) [20/ур.]
- Extended Lifespan (Увеличенный срок жизни) [2/ур.]
- Striking ST (Ударная сила) [5/ур.]
- Luck (Удача) [разл.]
- Terror (Ужас) [30+10/ур.]
- Vampiric Bite (Укус вампира) [30+5/ур.]
- Enhanced Defenses (Улучшенная защита) [разл.]
- Enhanced Tracking (Улучшенное слежение) [5/ур.]
- Ultrasonic Speech (Ультразвуковая речь) [0-10]
- Ultravision (Ультразрение) [0-10]
- Ultrahearing (Ультраслух) [0-10]
- Shrinking (Уменьшение) [5/ур.]
- Universal Digestion (Универсальное пищеварение) [5]
- Alcohol Tolerance (Устойчивость к алкоголю) [1]
- Vacuum Support (Устойчивость к вакууму) [5]
- Pressure Support (Устойчивость к давлению) [5-15]
- Magic Resistance (Устойчивость к магии) [2/ур.]
- Improved G-Tolerance (Устойчивость к перегрузкам) [5-25]
- Radiation Tolerance (Устойчивость к радиации) [разл.]
- Injury Tolerance (Устойчивость к ранениям) [разл.]
- Temperature Tolerance (Устойчивость к температуре) [1/ур.]
- Double-Jointed (Феноменальная гибкость) [15]
- Filter Lungs (Фильтрация воздуха) [5]
- Photographic Memory (Фотографическая память) [10]
- Chameleon (Хамелеон) [5/ур.]
- Charisma (Харизма) [5/ур.]
- Walk on Air (Ходьба по воздуху) [20]
- Walk on Liquid (Ходьба по жидкости) [15]
- Brachiator (Цепкость) [5]
- Sanitized Metabolism (Чистый метаболизм) [1]
- Mind Reading (Чтение мыслей) [30]
- Sensitive Touch (Чувствительное прикосновение) [10]
- Vibration Sense (Чувство вибрации) [10]
- Danger Sense (Чувство опасности) [15]
- 3D Spatial Sense (Чувство пространства) [10]
- Spines (Шипы) [1/3]
- Elastic Skin (Эластичная кожа) [20]
- Empathy (Эмпатия) [15]

ОФИЦИАЛЬНЫЙ СПИСОК НЕДОСТАТКОВ (GURPS Disadvantages):
- Alcoholism (Алкоголизм) [-15/-20]
- Selfless (Альтруист) [-5*]
- Amnesia (Амнезия) [-10/-25]
- Lifebane (Аура смерти) [-10]
- Callous (Безжалостный) [-5]
- No Legs (Безногий) [разл.]
- Killjoy (Безрадостный) [-15]
- Invertebrate (Беспозвоночный) [-20]
- Neutered (Бесполый) [-1]
- Insomniac (Бессонница) [-10/-15]
- Imaginative (Богатое воображение) [-1]
- Bad Back (Боли в спине) [-15/-25]
- Fearfulness (Боязливость) [-2/ур.]
- Dread (Боязнь) [разл.]
- Squeamish (Брезгливость) [-10*]
- Self-Destruct (Быстрое старение) [-10]
- Appearance (Внешность: Уродство и т.д.) [разл.]
- Bad Temper (Вспыльчивость) [-10*]
- Flashbacks (Галлюцинации) [разл.]
- Hemophilia (Гемофилия) [-30]
- Gigantism (Гигантизм) [0]
- Deafness (Глухота) [-20]
- Hunchback (Горбун) [-10]
- Proud (Гордость) [-1]
- Horizontal (Горизонтальный) [-10]
- Colorblindness (Дальтонизм) [-10]
- Dyslexia (Дислексия) [-10]
- Gullibility (Доверчивость) [-10*]
- Extra Sleep (Долго спит) [-2/ур.]
- Odious Personal Habits (Дурные привычки) [-5/-10/-15]
- Greed (Жадность) [-15*]
- Bestial (Животное поведение) [-10/-15]
- Stress Atavism (Животный стресс) [разл.*]
- Horrible Hangovers (Жуткое похмелье) [-1]
- Delusions (Заблуждения) [-1/-5..-15]
- Dependency (Зависимость) [разл.]
- Jealousy (Зависть) [-10]
- Bully (Задира) [-10*]
- Stuttering (Заикание) [-10]
- Honesty (Законопослушный) [-10*]
- Decreased Time Rate (Замедленный ход времени) [-100]
- Infectious Attack (Заражение) [-5]
- Social Disease (Заразная болезнь) [-5]
- Shyness (Застенчивость) [-5/-10/-20]
- Confused (Заторможенный) [-10*]
- Personality Change (Изменчивое поведение) [-1]
- Impulsiveness (Импульсивность) [-10*]
- Draining (Истощение) [разл.]
- Dwarfism (Карликовость) [-15]
- Kleptomania (Клептомания) [-15*]
- Short Lifespan (Короткий срок жизни) [-10/ур.]
- Space Sickness (Космическая болезнь) [-10]
- Hidebound (Косный) [-5]
- Total Klutz (Крайне неуклюжий) [-15]
- Bowlegged (Кривоногий) [-1]
- Bloodlust (Кровожадность) [-10*]
- Xenophilia (Ксенофилия) [-10*]
- Night Blindness (Куриная слепота) [-10]
- Easy to Read (Легко понять) [-10]
- Easy to Kill (Легко убить) [-2/ур.]
- Laziness (Лень) [-10]
- Lunacy (Лунатизм) [-10]
- Curious (Любопытство) [-5*]
- Manic-Depressive (Маниакально-депрессивный) [-20]
- Megalomania (Мания величия) [-10]
- Slow Eater (Медленно ест) [-10]
- Slow Riser (Медленно просыпается) [-5]
- Slow Healing (Медленное заживление) [-5/ур.]
- Motion Sickness (Морская болезнь) [-10]
- On the Edge (На грани) [-15*]
- Obsession (Навязчивая идея) [-1/-5/-10*]
- Trickster (Насмешник) [-15*]
- Non-Iconographic (Не воспринимает символы) [-10]
- Innumerate (Не воспринимает цифры) [-5]
- Unluckiness (Невезение) [-10]
- Unnatural Features (Неестественные черты) [разл.]
- Nervous Stomach (Нежный желудок) [-1]
- Berserk (Неистовство) [-10*]
- Unhealing (Неисцеляемый) [-20/-30]
- Incompetence (Некомпетентность) [-1]
- Uncontrollable Appetite (Неконтролируемый аппетит) [-15*]
- Staid (Нелюбознательный) [-1]
- Incurious (Нелюбопытный) [-5*]
- Mute (Немой) [-25]
- Uncongenial (Необщительный) [-1]
- Unusual Biochemistry (Необычная биохимия) [-5]
- Alcohol Intolerance (Непереносимость алкоголя) [-1]
- Oblivious (Непонимающий) [-5]
- Dislikes (Неприязнь) [-1]
- Disturbing Voice (Неприятный голос) [-10]
- Bad Smell (Неприятный запах) [-10]
- Short Attention Span (Непродолжительное внимание) [-10*]
- Neurological Disorder (Нервное расстройство) [разл.]
- Indecisive (Нерешительность) [-10*]
- Clueless (Несообразительный) [-10]
- Unfit (Неспортивный) [-5]
- Cannot Speak (Неспособен говорить) [-15]
- Cannot Float (Неспособен плавать) [-1]
- Cannot Learn (Неспособен учиться) [-30]
- No Depth Perception (Нет восприятия глубины) [-15]
- No Manipulators (Нет манипуляторов) [-50]
- No Sense of Smell/Taste (Нет обоняния/вкуса) [-5]
- Numb (Нет осязания) [-20]
- Missing Digit (Нет пальца) [-2/-5]
- No Fine Manipulators (Нет хороших манипуляторов) [-30]
- No Sense of Humor (Нет чувства юмора) [-10]
- Intolerance (Нетерпимость) [разл.]
- Ham-Fisted (Неуклюжие руки) [-5/-10]
- Klutz (Неуклюжий) [-5]
- Low Empathy (Нечувствительный) [-20]
- Low Self-Image (Низкая самооценка) [-10]
- Low TL (Низкий ТУ) [-5/ур.]
- Low Pain Threshold (Низкий болевой порог) [-10]
- Nocturnal (Ночной житель) [-20]
- Nightmares (Ночные кошмары) [-5*]
- Gluttony (Обжорство) [-5*]
- Restricted Vision (Ограниченная область зрения) [-15/-30]
- Restricted Diet (Ограниченный рацион) [-10..-40]
- Loner (Одиночка) [-5*]
- One Hand (Одна кисть) [-15]
- One Eye (Одноглазый) [-15]
- One Arm (Однорукий) [-20]
- Distinctive Features (Особые приметы) [-1]
- Weakness (Ослабление) [разл.]
- Careful (Осторожный) [-1]
- Revulsion (Отвращение) [-5..-15]
- Very Unfit (Очень неспортивный) [-15]
- Very Fat (Очень толстый) [-5]
- Quadriplegic (Парализованный) [-80]
- Paranoia (Паранойя) [-10]
- Pacifism (Пацифизм) [разл.]
- Reprogrammable (Перепрограммируемый) [-10]
- Pyromania (Пиромания) [-5*]
- Increased Consumption (Повышенное потребление) [-10/ур.]
- Increased Life Support (Повышенные требования к среде) [разл.]
- Overweight (Полный) [-1]
- Semi-Upright (Полупрямоходящий) [-5]
- Post-Combat Shakes (Постбоевой синдром) [-5*]
- Mistaken Identity (Похожая внешность) [-5]
- Truthfulness (Правдивость) [-5*]
- Phantom Voices (Призрачные голоса) [-5..-15]
- Addiction (Пристрастие) [разл.]
- Weirdness Magnet (Притягивающий необычное) [-15]
- Cursed (Проклятый) [-75]
- Nosy (Проныра) [-1]
- Frightens Animals (Пугает животных) [-10]
- Slave Mentality (Рабский менталитет) [-40]
- Lecherousness (Развратность) [-15*]
- Split Personality (Раздвоение личности) [-15*]
- Compulsive Behavior (Разорительная привычка) [-5..-15*]
- Wounded (Рана) [-5]
- Absent-Mindedness (Рассеянность) [-15]
- Distractible (Рассеяный) [-1]
- Sadism (Садизм) [-15*]
- Overconfidence (Самоуверенность) [-5*]
- Supersensitive (Сверхчувствительный) [-15]
- Supernatural Features (Сверхъестественные черты) [разл.]
- Miserliness (Скупость) [-10*]
- Bad Grip (Слабая хватка) [-5/ур.]
- Bad Sight (Слабое зрение) [-25]
- Weak Bite (Слабый укус) [-2]
- Blindness (Слепота) [-50]
- Terminally Ill (Смертельная болезнь) [-50/-75/-100]
- Sleepy (Сонливый) [разл.]
- Combat Paralysis (Ступор в бою) [-15]
- Shadow Form (Теневая форма) [-20]
- Fat (Толстый) [-3]
- Workaholic (Трудоголик) [-5]
- Cowardice (Трусость) [-10*]
- Hard of Hearing (Тугоухость) [-10]
- Unique (Уникальный) [-5]
- Stubbornness (Упрямство) [-5]
- Vulnerability (Уязвимость) [разл.]
- Magic Susceptibility (Уязвимость к магии) [-3/ур.]
- Fanaticism (Фанатизм) [-15]
- Charitable (Филантропия) [-15*]
- Phobias (Фобии) [разл.*]
- Sexless (Фригидность) [-1]
- Sleepwalker (Ходит во сне) [-5*]
- Cold-Blooded (Холоднокровный) [-5/-10]
- Lame (Хромой) [-10/-30]
- Chronic Depression (Хроническая депрессия) [-15*]
- Chronic Pain (Хронические боли) [разл.]
- Fragile (Хрупкий) [разл.]
- Skinny (Худой) [-5]
- G-Intolerance (Чувствительность к гравитации) [-10/-20]
- Acceleration Weakness (Чувствительность к ускорению) [-1]
- Sense of Duty (Чувство долга) [-2/-20]
- Light Sleeper (Чуткий сон) [-5]
- Noisy (Шумный) [-2/ур.]
- Selfish (Эгоист) [-5*]
- Electrical (Электроника) [-20]
- Epilepsy (Эпилепсия) [-30]

ОФИЦИАЛЬНЫЕ МОДИФИКАТОРЫ (GURPS Enhancements & Limitations):
Улучшения (Enhancements):
- Cosmic (Абсолют) [разл.]
- Aura (Аура) [+80%]
- Reduced Time (Быстрая подготовка) [+20%/ур.]
- Rapid Fire (Быстрый огонь) [разл.]
- Explosion (Взрыв) [+50%/ур.]
- Affects Substantial (Воздействие на материальное) [+40%]
- Affects Insubstantial (Воздействие на нематериальное) [+20%]
- Hazard (Вредные факторы) [разл.]
- Selectivity (Выбор) [+10%]
- Double Blunt Trauma (Двойная тупая травма) [+20%]
- Double Knockback (Двойное отбрасывание) [+20%]
- Underwater (Действует под водой) [+20%]
- Armor Divisor (Делитель брони) [разл.]
- Ranged (Дистанционность) [+40%]
- Drifting (Дрейф) [+20%]
- Delay (Задержка) [разл.]
- Incendiary (Зажигательная) [+10%]
- Malediction (Заклятье) [разл.]
- Selective Area (Избирательная область) [+20%]
- Surge (Импульс) [+20%]
- Contact Agent (Контактное действие) [+150%]
- Cone (Конус) [разл.]
- Blood Agent (Кровяное действие) [+100%]
- Damage Modifiers (Модификаторы повреждения) [разл.]
- Overhead (Навесная траектория) [+30%]
- No Signature (Незаметность) [+20%]
- Area Effect (Область действия) [+50%/ур.]
- Fragmentation (Осколки) [+15%/1к]
- Based on Attribute (Основано на атрибуте) [+20%]
- Sense-Based (Основано на чувстве) [разл.]
- Variable (Переменная сила) [+5%]
- Mobile (Перемещение) [+40%/ур.]
- Side Effect (Побочный эффект) [разл.]
- Follow-Up (Последующая) [разл.]
- Persistent (Продолжительность) [+40%]
- Radiation (Радиация) [+25%/+100%]
- Respiratory Agent (Респираторное действие) [+50%]
- Homing (Самонаведение) [разл.]
- Link (Связь) [+10%/+20%]
- Symptoms (Симптомы) [разл.]
- Low Signature (Слабая заметность) [+10%]
- Wall (Стена) [+30%/+60%]
- Jet (Струя) [+0%]
- Accurate (Точность) [+5%/ур.]
- Increased Range (Увеличенная дистанция) [+10%/ур.]
- Extended Duration (Увеличенная продолжительность) [разл.]
- Reduced Fatigue Cost (Уменьшенная усталость) [+20%/ур.]
- Guided (Управление) [+50%]
- Cyclic (Цикличность) [разл.]

Ограничения (Limitations):
- Uncontrollable (Бесконтрольность) [-10%/-30%]
- Bombardment (Бомбардировка) [разл.]
- Temporary Disadvantage (Временный недостаток) [разл.]
- Costs Fatigue (Вызывает усталость) [разл.]
- Always On (Действует постоянно) [разл.]
- Armor Divisor (Делитель брони) [разл.]
- Pact (Договор) [разл.]
- Accessibility (Доступность) [разл.]
- Emanation (Излучение) [-20%]
- Onset (Инкубация) [разл.]
- Contact Agent (Контактное действие) [-30%]
- Melee Attack (Контактный бой) [разл.]
- Blood Agent (Кровяное действие) [-40%]
- Breakable (Можно разбить) [разл.]
- Can Be Stolen (Можно украсть) [разл.]
- No Wounding (Не наносит ран) [-50%]
- Unreliable (Ненадежность) [разл.]
- Nuisance Effect (Неприятный эффект) [разл.]
- No Knockback (Нет отбрасывания) [-10%]
- No Blunt Trauma (Нет тупой травмы) [-20%]
- Inaccurate (Неточный) [-5%/ур.]
- Untrainable (Нетренируемость) [-40%]
- Sense-Based (Основано на чувстве) [разл.]
- Damage Limitations (Ограничения повреждений) [разл.]
- Limited Use (Ограниченное использование) [разл.]
- Full Power in Emergencies Only (Полная сила только в критических ситуациях) [-20%]
- Dissipation (Рассеивание) [-50%]
- Mitigator (Смягчение) [разл.]
- Resistible (Сопротивление) [разл.]
- Unconscious Only (Только бессознательно) [-20%]
- Emergencies Only (Только в критических ситуациях) [-30%]
- Takes Extra Time (Требует дополнительного времени) [-10%/ур.]
- Takes Recharge (Требует перезарядки) [разл.]
- Preparation Required (Требует подготовки) [разл.]
- Trigger (Триггер) [разл.]
- Extra Recoil (Увеличенная отдача) [-10%/ур.]
- Reduced Range (Уменьшенная дистанция) [-10%/ур.]
- Unique (Уникальность) [-25%]`;

    // Dynamically adjust responseSchema based on count
    let responseSchema: any;
    if (numToGenerate > 1) {
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          mutations: {
            type: Type.ARRAY,
            description: `Массив из ровно ${numToGenerate} сгенерированных уникальных мутаций`,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Название мутации на русском языке" },
                theme: { type: Type.STRING, description: "Тема мутации" },
                bodySystem: { type: Type.STRING, description: "Измененная или затронутая система тела" },
                description: { type: Type.STRING, description: "Подробное художественное описание внешнего вида и проявлений мутации" },
                advantages: {
                  type: Type.ARRAY,
                  description: "Список преимуществ GURPS для этой мутации",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING, description: "Название преимущества на русском" },
                      englishName: { type: Type.STRING, description: "Официальное название на английском (например, 'Innate Attack')" },
                      basePoints: { type: Type.INTEGER, description: "Базовая стоимость преимущества в очках" },
                      details: { type: Type.STRING, description: "Описание работы механики в игре GURPS" },
                      modifiers: {
                        type: Type.ARRAY,
                        description: "Модификаторы преимущества (улучшения и ограничения)",
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            name: { type: Type.STRING, description: "Название модификатора на русском" },
                            percent: { type: Type.INTEGER, description: "Процент изменения стоимости (например, -10 или 20)" },
                          },
                          required: ["name", "percent"],
                        },
                      },
                      finalPoints: { type: Type.INTEGER, description: "Итоговая стоимость с учетом модификаторов" },
                    },
                    required: ["name", "englishName", "basePoints", "details", "modifiers", "finalPoints"],
                  },
                },
                disadvantages: {
                  type: Type.ARRAY,
                  description: "Список недостатков GURPS для этой мутации",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING, description: "Название недостатка на русском" },
                      englishName: { type: Type.STRING, description: "Официальное название на английском (например, 'Unnatural Features')" },
                      basePoints: { type: Type.INTEGER, description: "Базовая стоимость недостатка в очках (отрицательное число, например, -5)" },
                      details: { type: Type.STRING, description: "Описание работы механических штрафов в игре" },
                      modifiers: {
                        type: Type.ARRAY,
                        description: "Модификаторы недостатка, если применимо",
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            name: { type: Type.STRING, description: "Название модификатора" },
                            percent: { type: Type.INTEGER, description: "Процент изменения (например, -10)" },
                          },
                          required: ["name", "percent"],
                        },
                      },
                      finalPoints: { type: Type.INTEGER, description: "Итоговая стоимость недостатка (отрицательное число)" },
                    },
                    required: ["name", "englishName", "basePoints", "details", "modifiers", "finalPoints"],
                  },
                },
                totalPositivePoints: { type: Type.INTEGER, description: "Суммарная стоимость всех преимуществ в очках" },
                totalNegativePoints: { type: Type.INTEGER, description: "Суммарная стоимость всех недостатков в очках (отрицательное число)" },
                netPoints: { type: Type.INTEGER, description: "Чистая стоимость мутации (преимущества + недостатки)" },
              },
              required: [
                "name",
                "theme",
                "description",
                "advantages",
                "disadvantages",
                "totalPositivePoints",
                "totalNegativePoints",
                "netPoints",
              ],
            },
          },
        },
        required: ["mutations"],
      };
    } else {
      // Single mutation schema (backward compatible)
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "Название мутации на русском языке (например, 'Кислотный плевок')",
          },
          theme: {
            type: Type.STRING,
            description: "Тема мутации (например, 'Биологическая', 'Радиационная' и т.д.)",
          },
          bodySystem: {
            type: Type.STRING,
            description: "Измененная или затронутая система тела",
          },
          description: {
            type: Type.STRING,
            description: "Подробное художественное описание внешнего вида и проявлений мутации",
          },
          advantages: {
            type: Type.ARRAY,
            description: "Список преимуществ GURPS для этой мутации",
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Название преимущества на русском" },
                englishName: { type: Type.STRING, description: "Официальное название на английском (например, 'Innate Attack')" },
                basePoints: { type: Type.INTEGER, description: "Базовая стоимость преимущества в очках" },
                details: { type: Type.STRING, description: "Описание работы механики в игре GURPS" },
                modifiers: {
                  type: Type.ARRAY,
                  description: "Модификаторы преимущества (улучшения и ограничения)",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING, description: "Название модификатора на русском" },
                      percent: { type: Type.INTEGER, description: "Процент изменения стоимости (например, -10 или 20)" },
                    },
                    required: ["name", "percent"],
                  },
                },
                finalPoints: { type: Type.INTEGER, description: "Итоговая стоимость с учетом модификаторов" },
              },
              required: ["name", "englishName", "basePoints", "details", "modifiers", "finalPoints"],
            },
          },
          disadvantages: {
            type: Type.ARRAY,
            description: "Список недостатков GURPS для этой мутации",
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Название недостатка на русском" },
                englishName: { type: Type.STRING, description: "Официальное название на английском (например, 'Unnatural Features')" },
                basePoints: { type: Type.INTEGER, description: "Базовая стоимость недостатка в очках (отрицательное число, например, -5)" },
                details: { type: Type.STRING, description: "Описание работы механических штрафов в игре" },
                modifiers: {
                  type: Type.ARRAY,
                  description: "Модификаторы недостатка, если применимо",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING, description: "Название модификатора" },
                      percent: { type: Type.INTEGER, description: "Процент изменения (например, -10)" },
                    },
                    required: ["name", "percent"],
                  },
                },
                finalPoints: { type: Type.INTEGER, description: "Итоговая стоимость недостатка (отрицательное число)" },
              },
              required: ["name", "englishName", "basePoints", "details", "modifiers", "finalPoints"],
            },
          },
          totalPositivePoints: {
            type: Type.INTEGER,
            description: "Суммарная стоимость всех преимуществ в очках",
          },
          totalNegativePoints: {
            type: Type.INTEGER,
            description: "Суммарная стоимость всех недостатков в очках (отрицательное число)",
          },
          netPoints: {
            type: Type.INTEGER,
            description: "Чистая стоимость мутации (преимущества + недостатки)",
          },
        },
        required: [
          "name",
          "theme",
          "description",
          "advantages",
          "disadvantages",
          "totalPositivePoints",
          "totalNegativePoints",
          "netPoints",
        ],
      };
    }

    const response = await generateAIContent(req, {
      prompt,
      systemInstruction,
      temperature: 1.0,
      responseSchema,
    });

    const jsonText = response.text?.trim() || "{}";
    const mutationData = JSON.parse(jsonText);
    res.json(mutationData);
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    res.status(500).json({ error: getReadableAIError(error) });
  }
});

// API Route for generating a highly-detailed visually rich English image prompt using Gemini 3.5 Flash
app.post("/api/generate-prompt", async (req, res) => {
  try {
    const { mutationName, mutationDescription, mutationTheme, advantages = [], disadvantages = [], subjectType = "Человек", style = "anime" } = req.body;
    
    if (!mutationName || !mutationDescription) {
      return res.status(400).json({ error: "Missing mutationName or mutationDescription" });
    }

    const subjectDescription = subjectType === "Человек" 
      ? "a human mutant" 
      : `an anthropomorphic animal (${subjectType}) mutant`;

    const advantagesText = advantages.map((a: any) => `${a.name} (${a.details})`).join("; ");
    const disadvantagesText = disadvantages.map((d: any) => `${d.name} (${d.details})`).join("; ");

    const prompt = `Create a visually rich, professional image generation prompt in English for:
- Subject: ${subjectDescription}
- Mutation Name: ${mutationName}
- Mutation Theme: ${mutationTheme}
- Description: ${mutationDescription}
- Visual Traits: ${advantagesText || "none"}
- Physical Defects / Side Effects: ${disadvantagesText || "none"}
- Style Option: ${style}`;

    const systemInstruction = `You are a professional AI image generation prompt engineer.
Your task is to translate and expand a given GURPS mutant character description (in Russian) into a highly detailed, professional, and visually rich ENGLISH prompt for state-of-the-art image generators (like Midjourney, Stable Diffusion, or DALL-E).

CRITICAL DIRECTIVES:
1. DO NOT include any GURPS rules, point values (e.g., "[15]", "PTS", "очки"), game-mechanic keywords, or stats in the output.
2. DO NOT mention rulebooks, GURPS system, or tabletop terms.
3. Translate and blend all concepts, names of traits, and description details into visually descriptive English.
4. Describe the physical manifestation of the mutation in rich visual detail: what does it look like on the body, texture, colors, light emissions, material, and how it transforms the subject.
5. Incorporate the requested style (${style}):
   - 'anime': high quality digital anime illustration, vibrant colors, clean line art, key visual.
   - 'realistic': photo-realistic 8k resolution, cinematic volumetric lighting, intricate skin and materials.
   - 'cyberpunk': futuristic dark synthwave art, glowing neon, mechanical bio-hardware, urban background.
   - 'sketch': vintage hand-drawn monochrome pencil sketch, RPG rulebook illustration, fine cross-hatching.
6. The output must be ONLY the plain-text English prompt, with no surrounding quotes or markdown.`;

    const response = await generateAIContent(req, {
      prompt,
      systemInstruction,
      temperature: 0.8,
    });

    const generatedPrompt = response.text?.trim() || "";
    res.json({ prompt: generatedPrompt });
  } catch (error: any) {
    console.error("Gemini Prompt Generation Error:", error);
    res.status(500).json({ error: getReadableAIError(error) });
  }
});

// Serve frontend assets and start listening wrapped in async function to avoid top-level await
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
