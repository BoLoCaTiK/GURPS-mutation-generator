import React, { useState, useEffect } from "react";
import { 
  Dna, 
  Sparkles, 
  Shield, 
  Skull, 
  Trash2, 
  Plus, 
  Copy, 
  Download, 
  Upload, 
  RefreshCw, 
  Sliders, 
  BookOpen, 
  User, 
  Zap,
  Info,
  ChevronRight,
  UserCheck,
  Check,
  AlertCircle,
  Heart,
  Search,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Star,
  LayoutGrid,
  List,
  Key
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Mutation, Character } from "./types";

// Predefined presets for character types
const CHARACTER_PRESETS = [
  {
    name: "Лёгкий мутант (Stalker)",
    positive: 25,
    negative: -10,
    theme: "Радиационная",
    description: "Человек, получивший небольшие полезные приспособления в зоне отчуждения. Невысокие штрафы."
  },
  {
    name: "Био-монстр (Xenomorph)",
    positive: 75,
    negative: -30,
    theme: "Биологическая",
    description: "Существенные физические превосходства, оплаченные пугающей неестественной внешностью."
  },
  {
    name: "Пси-Пророк (Esper)",
    positive: 50,
    negative: -20,
    theme: "Псионическая",
    description: "Мощный ментальный мутант, страдающий от головных болей или социальной изоляции."
  },
  {
    name: "Кибер-Гибрид (Cyborg)",
    positive: 60,
    negative: -15,
    theme: "Кибернетическая",
    description: "Организм со вшитыми имплантами, дающими боевые преимущества, но требующими ухода."
  },
  {
    name: "Дитя Хаоса (Chaos Spawn)",
    positive: 100,
    negative: -50,
    theme: "Магическая",
    description: "Разрушительная сила первородного хаоса. Огромная мощь и катастрофические недостатки."
  }
];

const THEMES = [
  "Любая",
  "Биологическая",
  "Радиационная",
  "Псионическая",
  "Магическая",
  "Кибернетическая",
  "Космическая"
];

const EFFECT_TYPES = ["Физический", "Ментальный"];
const COMPLEXITIES = ["Минорная", "Мажорная", "Экстремальная"];
const PORTRAIT_SUBJECTS = ["Человек", "Фурри-кот", "Фурри-волк", "Фурри-ящер", "Фурри-фенёк"];

const BODY_SYSTEMS = [
  "Опорно-двигательная система (кости, скелет, мышцы)",
  "Нервная система и мозг (психика, рефлексы, разум)",
  "Органы чувств (зрение, слух, обоняние, сенсоры)",
  "Покровная система (кожа, чешуя, шерсть, панцирь)",
  "Дыхательная система (легкие, жабры, фильтры)",
  "Кровеносная и иммунная система (кровь, сердце)",
  "Пищеварительная система (желудок, пищевод, зубы)",
  "Конечности и придатки (крылья, хвост, тентакли)",
  "Голова, лицо и челюсти (рога, клыки, сенсорные усы)",
  "Биохимическая система (железы, яды, регенерация)"
];

const BODY_SYSTEM_OPTIONS = ["Случайный автовыбор", ...BODY_SYSTEMS];

export default function App() {
  // Generator states
  const [positiveTarget, setPositiveTarget] = useState<number>(30);
  const [negativeTarget, setNegativeTarget] = useState<number>(-15);
  const [selectedThemes, setSelectedThemes] = useState<string[]>(["Любая"]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedComplexities, setSelectedComplexities] = useState<string[]>([]);
  const [customWishes, setCustomWishes] = useState<string>("");
  const [selectedBodySystem, setSelectedBodySystem] = useState<string>("Случайный автовыбор");
  
  // App operational states
  const [currentMutation, setCurrentMutation] = useState<Mutation | null>(() => {
    try {
      const saved = localStorage.getItem("xg_current_mutation");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generateCount, setGenerateCount] = useState<number>(1);
  
  const [sessionHistory, setSessionHistory] = useState<Mutation[]>(() => {
    try {
      const saved = localStorage.getItem("xg_session_history");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [favorites, setFavorites] = useState<Mutation[]>(() => {
    try {
      const saved = localStorage.getItem("xg_favorites");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"generator" | "history" | "favorites" | "presets">("generator");

  const [historyViewMode, setHistoryViewMode] = useState<"compact" | "detailed">(() => {
    try {
      const saved = localStorage.getItem("xg_history_view_mode");
      return saved === "detailed" ? "detailed" : "compact";
    } catch (e) {
      return "compact";
    }
  });

  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      localStorage.setItem("xg_history_view_mode", historyViewMode);
    } catch (e) {}
  }, [historyViewMode]);

  // Character States
  const [character, setCharacter] = useState<Character>(() => {
    try {
      const saved = localStorage.getItem("xg_character");
      return saved ? JSON.parse(saved) : { name: "Безымянный Мутант", mutations: [] };
    } catch (e) {
      return { name: "Безымянный Мутант", mutations: [] };
    }
  });

  const [isEditingCharName, setIsEditingCharName] = useState<boolean>(false);
  const [tempCharName, setTempCharName] = useState<string>("");

  // Search / Expand states for lists
  const [historySearchQuery, setHistorySearchQuery] = useState<string>("");
  const [favoritesSearchQuery, setFavoritesSearchQuery] = useState<string>("");
  const [expandedMutations, setExpandedMutations] = useState<{[key: string]: boolean}>({});

  // AI Portrait States
  const [selectedSubject, setSelectedSubject] = useState<string>("Человек");
  const [furrySpecies, setFurrySpecies] = useState<string>("кот");
  const [customFurrySpecies, setCustomFurrySpecies] = useState<string>("");
  const [promptStyle, setPromptStyle] = useState<string>("anime"); // anime, realistic, cyberpunk, sketch
  const [copiedPromptName, setCopiedPromptName] = useState<string | null>(null);

  const [aiPrompts, setAiPrompts] = useState<{[key: string]: string}>({});
  const [isPromptLoading, setIsPromptLoading] = useState<boolean>(false);

  // Personal API Key States
  const [userApiKey, setUserApiKey] = useState<string>(() => {
    return localStorage.getItem("xg_user_api_key") || "";
  });
  const [tempApiKey, setTempApiKey] = useState<string>(() => {
    return localStorage.getItem("xg_user_api_key") || "";
  });
  const [customProviderUrl, setCustomProviderUrl] = useState<string>(() => {
    return localStorage.getItem("xg_custom_provider_url") || "";
  });
  const [tempProviderUrl, setTempProviderUrl] = useState<string>(() => {
    return localStorage.getItem("xg_custom_provider_url") || "";
  });
  const [customProviderModel, setCustomProviderModel] = useState<string>(() => {
    return localStorage.getItem("xg_custom_provider_model") || "";
  });
  const [tempProviderModel, setTempProviderModel] = useState<string>(() => {
    return localStorage.getItem("xg_custom_provider_model") || "";
  });
  const [isApiKeyPanelOpen, setIsApiKeyPanelOpen] = useState<boolean>(false);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);

  const handleSaveApiKey = (key: string, url: string = "", model: string = "") => {
    const trimmedKey = key.trim();
    const trimmedUrl = url.trim();
    const trimmedModel = model.trim();

    setUserApiKey(trimmedKey);
    setCustomProviderUrl(trimmedUrl);
    setCustomProviderModel(trimmedModel);

    localStorage.setItem("xg_user_api_key", trimmedKey);
    localStorage.setItem("xg_custom_provider_url", trimmedUrl);
    localStorage.setItem("xg_custom_provider_model", trimmedModel);

    showToast(trimmedKey ? "Конфигурация API успешно сохранена!" : "Настройки сброшены на серверные");
  };

  const fetchDetailedPrompt = async (mutation: Mutation, subject: string, style: string) => {
    if (!mutation || !mutation.name || !mutation.description) return;
    const activeSub = subject === "Человек" ? "Человек" : (customFurrySpecies.trim() || furrySpecies);
    const cacheKey = `${mutation.name}-${activeSub}-${style}`;
    
    // If already loaded, do not refetch
    if (aiPrompts[cacheKey]) return;

    setIsPromptLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (userApiKey) {
        headers["x-user-api-key"] = userApiKey;
      }
      if (customProviderUrl) {
        headers["x-custom-provider-url"] = customProviderUrl;
      }
      if (customProviderModel) {
        headers["x-custom-provider-model"] = customProviderModel;
      }
      const response = await fetch("/api/generate-prompt", {
        method: "POST",
        headers,
        body: JSON.stringify({
          mutationName: mutation.name,
          mutationDescription: mutation.description,
          mutationTheme: mutation.theme,
          advantages: mutation.advantages,
          disadvantages: mutation.disadvantages,
          subjectType: activeSub,
          style: style
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.prompt) {
          setAiPrompts(prev => ({ ...prev, [cacheKey]: data.prompt }));
          showToast("Промпт успешно оптимизирован с помощью AI!");
        } else {
          throw new Error("Empty prompt returned");
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        const msg = errData.error || "";
        if (msg.includes("quota") || msg.includes("429") || response.status === 429) {
          showToast("Превышена квота запросов AI. Скопируйте оффлайн-промпт!");
        } else {
          showToast("Ошибка оптимизации промпта. Используется оффлайн-промпт.");
        }
      }
    } catch (err) {
      console.error("Error generating detailed prompt:", err);
      showToast("Не удалось подключиться к AI-сервису. Используется оффлайн-промпт.");
    } finally {
      setIsPromptLoading(false);
    }
  };

  const generatePromptText = (mutation: Mutation, subject: string, style: string) => {
    const activeSubject = subject === "Человек" 
      ? "Человек" 
      : (customFurrySpecies.trim() || furrySpecies);

    const subjectPrefix = subject === "Человек" 
      ? "A human character" 
      : `An anthropomorphic furry ${activeSubject} character`;

    // Map themes to English descriptors
    const themeDescriptors: { [key: string]: string } = {
      "Биологическая": "biological organic growth, physical mutation, genetic modification",
      "Космическая": "cosmic energy, starlight aura, alien extraterrestrial features, galaxy theme",
      "Кибернетическая": "cybernetic parts, neon glowing wires, sleek robotic implants, sci-fi",
      "Магическая": "magical runes, mystical glowing runes, arcane energy, fantasy magic aura",
      "Псионическая": "psionic energy aura, glowing mental eyes, telekinetic ripples, psychic power",
      "Химическая": "toxic glowing liquid, bio-chemical experiment, hazard green neon details"
    };

    const themeDetails = themeDescriptors[mutation.theme] || "genetic mutant character";

    let basePrompt = "";
    if (style === "anime") {
      const subjectTag = subject === "Человек" 
        ? "1human, male or female character, detailed anime face" 
        : `1furry, anthropomorphic ${activeSubject}, animal face, furry ears, fluffy fur`;

      basePrompt = `masterpiece, best quality, highly detailed, solo, close-up portrait of ${subjectTag}, manifesting mutation: ${mutation.name}, theme of ${themeDetails}, dynamic lighting, vivid colors, game concept art, digital anime painting, key visual`;
    } else if (style === "realistic") {
      basePrompt = `Photorealistic close-up portrait of ${subjectPrefix} manifesting a powerful mutation: "${mutation.name}". Theme elements: ${themeDetails}. Photorealism, cinematic volumetric lighting, 8k resolution, intricate details, highly detailed skin and textures, unreal engine 5 render, award-winning portrait photography.`;
    } else if (style === "cyberpunk") {
      basePrompt = `Sleek cyberpunk digital painting of ${subjectPrefix} showing extreme mutation: "${mutation.name}". Glowing neon cyberware, dark synthwave cityscape background, volumetric fog, high-tech cyber-organic theme of ${themeDetails}, vibrant neon blue and hazard green accents, ArtStation trending.`;
    } else { // sketch (GURPS GURPS rulebook style)
      basePrompt = `Vintage pencil sketch of ${subjectPrefix} exhibiting a distinct mutation: "${mutation.name}". Hand-drawn monochrome line art, intricate cross-hatching shading, parchment paper texture, fantasy RPG rulebook illustration style, classical pencil concept design, old book sketch.`;
    }

    return basePrompt;
  };

  const getPromptText = (mutation: Mutation, subject: string, style: string) => {
    const activeSub = subject === "Человек" ? "Человек" : (customFurrySpecies.trim() || furrySpecies);
    const cacheKey = `${mutation.name}-${activeSub}-${style}`;
    return aiPrompts[cacheKey] || generatePromptText(mutation, subject, style);
  };

  // Sync state to LocalStorage
  useEffect(() => {
    if (currentMutation) {
      localStorage.setItem("xg_current_mutation", JSON.stringify(currentMutation));
    } else {
      localStorage.removeItem("xg_current_mutation");
    }
  }, [currentMutation]);

  useEffect(() => {
    localStorage.setItem("xg_session_history", JSON.stringify(sessionHistory));
  }, [sessionHistory]);

  useEffect(() => {
    localStorage.setItem("xg_favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem("xg_character", JSON.stringify(character));
  }, [character]);

  // Load sample on mount if none exists
  useEffect(() => {
    if (!currentMutation) {
      handleGenerate(true);
    }
  }, []);

  // Sync temp character name
  useEffect(() => {
    setTempCharName(character.name);
  }, [character.name]);

  const getBalancedBodySystems = (count: number): string[] => {
    if (selectedBodySystem !== "Случайный автовыбор") {
      return Array(count).fill(selectedBodySystem);
    }
    
    // Count occurrences of each system in the sessionHistory
    const counts: Record<string, number> = {};
    BODY_SYSTEMS.forEach(sys => {
      counts[sys] = 0;
    });
    
    sessionHistory.forEach(mut => {
      if (mut.bodySystem) {
        const found = BODY_SYSTEMS.find(sys => 
          sys.toLowerCase() === mut.bodySystem?.toLowerCase() ||
          mut.bodySystem?.toLowerCase().includes(sys.toLowerCase()) ||
          sys.toLowerCase().includes(mut.bodySystem?.toLowerCase() || "")
        );
        if (found) {
          counts[found]++;
        }
      }
    });
    
    const results: string[] = [];
    for (let i = 0; i < count; i++) {
      // Find the minimum count
      const minCount = Math.min(...BODY_SYSTEMS.map(sys => counts[sys]));
      
      // Find all systems that have this minimum count
      const candidates = BODY_SYSTEMS.filter(sys => counts[sys] === minCount);
      
      // Pick randomly from the candidates with the minimum count
      const randomIndex = Math.floor(Math.random() * candidates.length);
      const chosenSystem = candidates[randomIndex];
      results.push(chosenSystem);
      counts[chosenSystem]++;
    }
    return results;
  };

  const handleGenerate = async (isInitial = false) => {
    setIsGenerating(true);
    setError(null);
    try {
      const excludeNames = sessionHistory.map(m => m.name);
      const countToSend = isInitial ? 1 : generateCount;
      const targetSystems = getBalancedBodySystems(countToSend);
      
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (userApiKey) {
        headers["x-user-api-key"] = userApiKey;
      }
      if (customProviderUrl) {
        headers["x-custom-provider-url"] = customProviderUrl;
      }
      if (customProviderModel) {
        headers["x-custom-provider-model"] = customProviderModel;
      }
      const response = await fetch("/api/generate-mutation", {
        method: "POST",
        headers,
        body: JSON.stringify({
          positiveTarget,
          negativeTarget,
          themes: selectedThemes.includes("Любая") ? [] : selectedThemes,
          types: selectedTypes,
          complexities: selectedComplexities,
          wishes: customWishes,
          exclude: excludeNames,
          count: countToSend,
          bodySystems: targetSystems,
          bodySystem: targetSystems[0] || ""
        })
      });

      if (!response.ok) {
        let errMsg = "Не удалось связаться с сервером генерации. Проверьте подключение.";
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (e) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      
      if (countToSend > 1) {
        if (data && Array.isArray(data.mutations) && data.mutations.length > 0) {
          const generatedWithIds = data.mutations.map((mut: any, index: number) => ({
            ...mut,
            id: (Date.now() + index).toString()
          }));
          
          setCurrentMutation(generatedWithIds[0]);
          
          setSessionHistory(prev => {
            const newHistory = [...prev];
            generatedWithIds.forEach((newMut: any) => {
              if (!newHistory.some(m => m.name.toLowerCase() === newMut.name.toLowerCase())) {
                newHistory.unshift(newMut);
              }
            });
            return newHistory;
          });
          
          showToast(`Сгенерировано ${generatedWithIds.length} мутаций`);
        } else {
          throw new Error("Получены некорректные данные от ИИ. Попробуйте еще раз.");
        }
      } else {
        if (data && data.name) {
          const mutationWithId = { ...data, id: Date.now().toString() };
          setCurrentMutation(mutationWithId);
          
          setSessionHistory(prev => {
            if (prev.some(m => m.name.toLowerCase() === data.name.toLowerCase())) {
              return prev;
            }
            return [mutationWithId, ...prev];
          });
        } else {
          throw new Error("Получены некорректные данные от ИИ. Попробуйте еще раз.");
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Произошла непредвиденная ошибка");
    } finally {
      setIsGenerating(false);
    }
  };

  const isMutationFavorited = (mutation: Mutation) => {
    return favorites.some(f => f.name.toLowerCase() === mutation.name.toLowerCase());
  };

  const toggleFavorite = (mutation: Mutation) => {
    if (isMutationFavorited(mutation)) {
      setFavorites(prev => prev.filter(f => f.name.toLowerCase() !== mutation.name.toLowerCase()));
      showToast("Удалено из избранного");
    } else {
      setFavorites(prev => [mutation, ...prev]);
      showToast("Добавлено в избранное!");
    }
  };

  const exportHistory = () => {
    if (sessionHistory.length === 0) {
      showToast("История пуста!");
      return;
    }
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sessionHistory, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `gurps_mutation_history_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast("История успешно экспортирована!");
    } catch (err) {
      showToast("Не удалось экспортировать историю");
    }
  };

  const handleImportHistory = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            const validMutations = parsed.filter(item => item && typeof item === 'object' && 'name' in item && 'theme' in item);
            if (validMutations.length === 0) {
              showToast("Файл не содержит корректных мутаций!");
              return;
            }
            
            setSessionHistory(prev => {
              const merged = [...prev];
              let importedCount = 0;
              validMutations.forEach(m => {
                if (!merged.some(existing => existing.name.toLowerCase() === m.name.toLowerCase())) {
                  if (!m.id) {
                    m.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                  }
                  merged.unshift(m);
                  importedCount++;
                }
              });
              if (importedCount === 0) {
                showToast("Все импортируемые мутации уже есть в истории!");
              } else {
                showToast(`Успешно импортировано мутаций: ${importedCount}`);
              }
              return merged;
            });
          } else {
            showToast("Файл должен содержать массив мутаций!");
          }
        } catch (err) {
          showToast("Ошибка при чтении или парсинге JSON файла!");
        }
      };
    }
    // Reset file input value to allow importing the same file again if needed
    e.target.value = "";
  };

  const toggleTheme = (theme: string) => {
    if (theme === "Любая") {
      setSelectedThemes(["Любая"]);
      return;
    }
    setSelectedThemes(prev => {
      const next = prev.filter(t => t !== "Любая");
      if (next.includes(theme)) {
        const filtered = next.filter(t => t !== theme);
        return filtered.length === 0 ? ["Любая"] : filtered;
      } else {
        return [...next, theme];
      }
    });
  };

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleComplexity = (complexity: string) => {
    setSelectedComplexities(prev =>
      prev.includes(complexity) ? prev.filter(c => c !== complexity) : [...prev, complexity]
    );
  };

  const toggleExpand = (name: string) => {
    setExpandedMutations(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const addCurrentMutationToCharacter = () => {
    if (!currentMutation) return;
    
    // Check if already added
    if (character.mutations.some(m => m.name === currentMutation.name)) {
      showToast("Эта мутация уже добавлена персонажу!");
      return;
    }

    setCharacter(prev => ({
      ...prev,
      mutations: [...prev.mutations, currentMutation]
    }));
    showToast("Мутация добавлена персонажу!");
  };

  const removeMutationFromCharacter = (id?: string) => {
    if (!id) return;
    setCharacter(prev => ({
      ...prev,
      mutations: prev.mutations.filter(m => m.id !== id)
    }));
    showToast("Мутация удалена");
  };

  const saveCharacterName = () => {
    setCharacter(prev => ({ ...prev, name: tempCharName.trim() || "Безымянный Мутант" }));
    setIsEditingCharName(false);
  };

  const applyPreset = (preset: typeof CHARACTER_PRESETS[0]) => {
    setPositiveTarget(preset.positive);
    setNegativeTarget(preset.negative);
    setSelectedThemes([preset.theme]);
    setActiveTab("generator");
    showToast(`Применен шаблон: ${preset.name}`);
  };

  const showToast = (message: string) => {
    setCopyFeedback(message);
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  const copyMutationToClipboard = (mutation: Mutation) => {
    let text = `=== МУТАЦИЯ GURPS: ${mutation.name.toUpperCase()} ===\n`;
    text += `Тема: ${mutation.theme}\n`;
    if (mutation.bodySystem) {
      text += `Система тела: ${mutation.bodySystem}\n`;
    }
    text += `Описание: ${mutation.description}\n\n`;
    
    text += `--- Преимущества (${mutation.totalPositivePoints} очков):\n`;
    mutation.advantages.forEach(adv => {
      text += `• ${adv.name} (${adv.englishName}) - [${adv.finalPoints} очк.]\n`;
      text += `  База: ${adv.basePoints} очк. | ${adv.details}\n`;
      if (adv.modifiers.length > 0) {
        text += `  Модификаторы: ${adv.modifiers.map(m => `${m.name} (${m.percent >= 0 ? "+" : ""}${m.percent}%)`).join(", ")}\n`;
      }
    });
    
    text += `\n--- Недостатки (${mutation.totalNegativePoints} очков):\n`;
    mutation.disadvantages.forEach(dis => {
      text += `• ${dis.name} (${dis.englishName}) - [${dis.finalPoints} очк.]\n`;
      text += `  База: ${dis.basePoints} очк. | ${dis.details}\n`;
      if (dis.modifiers.length > 0) {
        text += `  Модификаторы: ${dis.modifiers.map(m => `${m.name} (${m.percent >= 0 ? "+" : ""}${m.percent}%)`).join(", ")}\n`;
      }
    });
    
    text += `\nЧистая стоимость мутации: ${mutation.netPoints >= 0 ? "+" : ""}${mutation.netPoints} очков.`;

    navigator.clipboard.writeText(text);
    showToast("Текст скопирован в буфер обмена!");
  };

  const exportCharacterToText = () => {
    const totalAdvantages = character.mutations.reduce((sum, m) => sum + m.totalPositivePoints, 0);
    const totalDisadvantages = character.mutations.reduce((sum, m) => sum + m.totalNegativePoints, 0);
    const netPoints = totalAdvantages + totalDisadvantages;

    let text = `==================================================\n`;
    text += ` ПЕРСОНАЖ GURPS 4e: ${character.name.toUpperCase()}\n`;
    text += ` СУММАРНАЯ СТОИМОСТЬ МУТАЦИЙ: ${netPoints >= 0 ? "+" : ""}${netPoints} очков\n`;
    text += ` (Преимущества: +${totalAdvantages} | Недостатки: ${totalDisadvantages})\n`;
    text += `==================================================\n\n`;

    if (character.mutations.length === 0) {
      text += "Нет активных мутаций.\n";
    } else {
      character.mutations.forEach((m, idx) => {
        text += `${idx + 1}. ${m.name.toUpperCase()} [${m.netPoints >= 0 ? "+" : ""}${m.netPoints} очк.]\n`;
        text += `Тема: ${m.theme}\n`;
        text += `Описание: ${m.description}\n\n`;
        
        text += `Преимущества:\n`;
        m.advantages.forEach(a => {
          text += `  - ${a.name} (${a.englishName}) [${a.finalPoints} очк.] (База: ${a.basePoints})\n`;
          text += `    Эффект: ${a.details}\n`;
          if (a.modifiers.length > 0) {
            text += `    Модификаторы: ${a.modifiers.map(mod => `${mod.name} (${mod.percent >= 0 ? "+" : ""}${mod.percent}%)`).join(", ")}\n`;
          }
        });
        
        text += `Недостатки:\n`;
        m.disadvantages.forEach(d => {
          text += `  - ${d.name} (${d.englishName}) [${d.finalPoints} очк.] (База: ${d.basePoints})\n`;
          text += `    Эффект: ${d.details}\n`;
          if (d.modifiers.length > 0) {
            text += `    Модификаторы: ${d.modifiers.map(mod => `${mod.name} (${mod.percent >= 0 ? "+" : ""}${mod.percent}%)`).join(", ")}\n`;
          }
        });
        text += `\n--------------------------------------------------\n\n`;
      });
    }

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${character.name.replace(/\s+/g, "_")}_GURPS_mutations.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Данные персонажа экспортированы!");
  };

  // Calculate Character totals
  const totalAdvantages = character.mutations.reduce((sum, m) => sum + m.totalPositivePoints, 0);
  const totalDisadvantages = character.mutations.reduce((sum, m) => sum + m.totalNegativePoints, 0);
  const totalNet = totalAdvantages + totalDisadvantages;

  const renderMutationCard = (
    mutation: Mutation,
    isExpanded: boolean,
    onToggleExpand?: () => void,
    showDeleteButton: boolean = false,
    onDelete?: () => void
  ) => {
    const isFav = isMutationFavorited(mutation);

    return (
      <div 
        key={mutation.id || mutation.name}
        className="bg-[#0d141f] border border-[#1a2c38] rounded overflow-hidden flex flex-col shadow-xl transition-all duration-300"
      >
        {/* Card Header Banner */}
        <div className="bg-[#05070a] border-b border-[#1a2c38]/50 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-[9px] font-mono uppercase bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded text-emerald-400">
                {mutation.theme}
              </span>
              {mutation.bodySystem && (
                <span className="text-[9px] font-mono uppercase bg-sky-950/60 border border-sky-500/30 px-2 py-0.5 rounded text-sky-400" title="Измененная система или часть тела">
                  {mutation.bodySystem}
                </span>
              )}
              <span className="text-[10px] font-mono text-slate-400 font-bold">
                СТОИМОСТЬ: {mutation.netPoints >= 0 ? "+" : ""}{mutation.netPoints} PTS
              </span>
            </div>
            <h3 className="text-lg font-black tracking-tight text-white uppercase flex items-center gap-2">
              {mutation.name}
            </h3>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <button
              onClick={() => toggleFavorite(mutation)}
              className={`p-2 rounded border border-[#1a2c38] transition-all cursor-pointer ${
                isFav 
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.2)]" 
                  : "bg-[#05070a] text-slate-400 hover:text-rose-400"
              }`}
              title={isFav ? "Удалить из избранного" : "Добавить в избранное"}
            >
              <Heart className={`w-4 h-4 ${isFav ? "fill-rose-500" : ""}`} />
            </button>

            <button
              onClick={() => copyMutationToClipboard(mutation)}
              className="p-2 bg-[#05070a] border border-[#1a2c38] rounded text-slate-400 hover:text-emerald-400 transition-all cursor-pointer"
              title="Скопировать GURPS-код в буфер обмена"
            >
              <Copy className="w-4 h-4" />
            </button>

            {showDeleteButton && onDelete && (
              <button
                onClick={onDelete}
                className="p-2 bg-[#05070a] border border-[#1a2c38] rounded text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                title="Удалить из этого списка"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {onToggleExpand && (
              <button
                onClick={onToggleExpand}
                className="p-2 bg-[#05070a] border border-[#1a2c38] rounded text-slate-400 hover:text-emerald-400 transition-all cursor-pointer"
                title={isExpanded ? "Свернуть" : "Развернуть"}
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Card Body */}
        {isExpanded && (
          <div className="p-4 md:p-6 flex flex-col gap-6">
            
            {/* Bio description */}
            <div className="bg-[#05070a] p-4 rounded border border-[#1a2c38] relative">
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest absolute top-2 right-3">BIO_DESC_CORE</span>
              <p className="text-xs text-slate-300 leading-relaxed italic pr-12">
                &ldquo;{mutation.description}&rdquo;
              </p>
            </div>

            {/* Split Grid for Details and Image Generator */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              
              {/* Point allocation lists */}
              <div className="space-y-4">
                
                {/* Advantages block */}
                <div className="bg-[#05070a] rounded border border-[#1a2c38] p-4">
                  <h4 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider mb-3 flex items-center justify-between border-b border-[#1a2c38]/40 pb-2">
                    <span>➕ ПРЕИМУЩЕСТВА (ADVANTAGES)</span>
                    <span>+{mutation.totalPositivePoints} PTS</span>
                  </h4>
                  {mutation.advantages.length === 0 ? (
                    <p className="text-[10px] text-slate-500 font-mono italic">Нет положительных качеств.</p>
                  ) : (
                    <div className="space-y-3.5">
                      {mutation.advantages.map((adv, idx) => (
                        <div key={idx} className="text-xs group/item">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-bold text-slate-200">
                              {adv.name} <span className="text-slate-500 text-[10px] font-mono">({adv.englishName})</span>
                            </span>
                            <span className="font-mono font-bold text-emerald-400 bg-emerald-950/20 border border-emerald-500/10 px-1 rounded">
                              [{adv.finalPoints}]
                            </span>
                          </div>
                          <p className="text-slate-400 text-[11px] mt-0.5 leading-normal">{adv.details}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 font-mono text-[9px] text-slate-500">
                            <span>База: {adv.basePoints} очк.</span>
                            {adv.modifiers.length > 0 && (
                              <>
                                <span className="text-slate-600">|</span>
                                <span className="text-emerald-500 font-bold">Модификаторы:</span>
                                {adv.modifiers.map((m, mIdx) => (
                                  <span key={mIdx} className="bg-[#101923] px-1 py-0.2 rounded border border-[#1a2c38] text-slate-300">
                                    {m.name} ({m.percent >= 0 ? "+" : ""}{m.percent}%)
                                  </span>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Disadvantages block */}
                <div className="bg-[#05070a] rounded border border-[#1a2c38] p-4">
                  <h4 className="text-xs font-bold font-mono text-rose-400 uppercase tracking-wider mb-3 flex items-center justify-between border-b border-[#1a2c38]/40 pb-2">
                    <span>➖ ШТРАФЫ И ДЕФЕКТЫ (DISADVANTAGES)</span>
                    <span>{mutation.totalNegativePoints} PTS</span>
                  </h4>
                  {mutation.disadvantages.length === 0 ? (
                    <p className="text-[10px] text-slate-500 font-mono italic">Нет дефектов или ограничений.</p>
                  ) : (
                    <div className="space-y-3.5">
                      {mutation.disadvantages.map((dis, idx) => (
                        <div key={idx} className="text-xs group/item">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-bold text-slate-200">
                              {dis.name} <span className="text-slate-500 text-[10px] font-mono">({dis.englishName})</span>
                            </span>
                            <span className="font-mono font-bold text-rose-400 bg-rose-950/20 border border-rose-500/10 px-1 rounded">
                              [{dis.finalPoints}]
                            </span>
                          </div>
                          <p className="text-slate-400 text-[11px] mt-0.5 leading-normal">{dis.details}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 font-mono text-[9px] text-slate-500">
                            <span>База: {dis.basePoints} очк.</span>
                            {dis.modifiers.length > 0 && (
                              <>
                                <span className="text-slate-600">|</span>
                                <span className="text-rose-500 font-bold">Модификаторы:</span>
                                {dis.modifiers.map((m, mIdx) => (
                                  <span key={mIdx} className="bg-[#101923] px-1 py-0.2 rounded border border-[#1a2c38] text-slate-300">
                                    {m.name} ({m.percent >= 0 ? "+" : ""}{m.percent}%)
                                  </span>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* AI Prompt Generator */}
              <div className="bg-[#05070a] border border-[#1a2c38] rounded p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-[#1a2c38]/40 pb-2.5">
                  <span className="text-xs font-bold uppercase font-mono text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" /> ГЕНЕРАТОР ПРОМПТОВ ДЛЯ AI (NANO BANANA)
                  </span>
                  <span className="text-[9px] font-mono text-slate-500 bg-[#0c121d] px-1.5 py-0.5 rounded border border-[#1a2c38]">GURPS PROMPTER</span>
                </div>

                {/* Subject Parameters directly inside the Prompt Generator */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider font-mono text-slate-500 mb-2">ТИП ПЕРСОНАЖА (РАСА)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedSubject("Человек")}
                        className={`py-1.5 px-3 rounded text-[11px] font-mono font-bold border text-center transition-all cursor-pointer ${
                          selectedSubject === "Человек"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                            : "bg-[#0c121d] text-slate-400 border-[#1a2c38] hover:border-slate-700"
                        }`}
                      >
                        Человек
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSubject("Фурри")}
                        className={`py-1.5 px-3 rounded text-[11px] font-mono font-bold border text-center transition-all cursor-pointer ${
                          selectedSubject === "Фурри"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                            : "bg-[#0c121d] text-slate-400 border-[#1a2c38] hover:border-slate-700"
                        }`}
                      >
                        Фурри (Антропоморф)
                      </button>
                    </div>
                  </div>

                  {selectedSubject === "Фурри" && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-3 overflow-hidden"
                    >
                      <div>
                        <label className="block text-[9px] uppercase tracking-wider font-mono text-slate-500 mb-1.5">ПОПУЛЯРНЫЕ ВИДЫ (ПРЕСЕТЫ)</label>
                        <div className="grid grid-cols-3 gap-1">
                          {["кот", "волк", "ящер", "фенёк", "тигр", "ягуар", "гепард", "варан", "лев", "гиена", "зебра", "жираф"].map(species => (
                            <button
                              key={species}
                              type="button"
                              onClick={() => {
                                setFurrySpecies(species);
                                setCustomFurrySpecies(""); // Clear custom if selecting a preset
                              }}
                              className={`px-1 py-1 rounded text-[10px] font-mono border text-center transition-all cursor-pointer ${
                                furrySpecies === species && !customFurrySpecies
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : "bg-[#0c121d] text-slate-400 border-[#1a2c38] hover:border-slate-800"
                              }`}
                            >
                              {species}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] uppercase tracking-wider font-mono text-slate-500 mb-1.5">СВОЙ ВАРИАНТ (ВИД ЖИВОТНОГО)</label>
                        <input
                          type="text"
                          value={customFurrySpecies}
                          onChange={(e) => setCustomFurrySpecies(e.target.value)}
                          placeholder="например: енот, дракон, акула, сова, лев"
                          className="w-full bg-[#0c121d] border border-[#1a2c38] hover:border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 rounded px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all font-mono"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Prompt style preset selector */}
                <div className="space-y-2">
                  <label className="block text-[9px] uppercase tracking-wider font-mono text-slate-500">СТИЛЬ И ПРЕСЕТ ИЗОБРАЖЕНИЯ</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: "anime", label: "Anime (Nano Banana)" },
                      { id: "realistic", label: "3D / Реализм" },
                      { id: "cyberpunk", label: "Cyberpunk Art" },
                      { id: "sketch", label: "RPG Книга (Sketch)" }
                    ].map(styleOpt => (
                      <button
                        key={styleOpt.id}
                        type="button"
                        onClick={() => setPromptStyle(styleOpt.id)}
                        className={`py-1.5 px-2 rounded text-[10px] font-mono font-bold border text-center transition-all cursor-pointer ${
                          promptStyle === styleOpt.id
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                            : "bg-[#0c121d] text-slate-400 border-[#1a2c38] hover:border-slate-700"
                        }`}
                      >
                        {styleOpt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Display parameter summary */}
                <div className="p-3 bg-[#0c121d] rounded border border-[#1a2c38] space-y-1">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono block">ТЕКУЩИЕ ПАРАМЕТРЫ СУБЪЕКТА:</span>
                  <div className="text-[11px] font-mono text-slate-300">
                    Раса: <strong className="text-emerald-400">{selectedSubject === "Человек" ? "Человек" : (customFurrySpecies.trim() || furrySpecies)}</strong> | Стиль: <strong className="text-emerald-400">{promptStyle.toUpperCase()}</strong>
                  </div>
                </div>

                {/* Generated prompt block */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[9px] uppercase tracking-wider font-mono text-slate-500">СФОРМИРОВАННЫЙ ПРОМПТ ДЛЯ КОПИРОВАНИЯ</label>
                    {isPromptLoading ? (
                      <span className="text-[9px] font-mono text-emerald-400 animate-pulse flex items-center gap-1">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin text-emerald-500" />
                        AI ДЕТАЛИЗИРУЕТ...
                      </span>
                    ) : aiPrompts[`${mutation.name}-${selectedSubject === "Человек" ? "Человек" : (customFurrySpecies.trim() || furrySpecies)}-${promptStyle}`] ? (
                      <span className="text-[9px] font-mono text-[#10b981] flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" />
                        AI ПРОМПТ ОПТИМИЗИРОВАН
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fetchDetailedPrompt(mutation, selectedSubject, promptStyle)}
                        className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 hover:text-emerald-300 rounded border border-emerald-500/30 hover:border-emerald-500/50 font-mono text-[9px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span>✨ ОПТИМИЗИРОВАТЬ ЧЕРЕЗ AI</span>
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <textarea
                      readOnly
                      value={getPromptText(mutation, selectedSubject, promptStyle)}
                      className="w-full bg-[#05070a] border border-[#1a2c38] rounded p-3 text-[10.5px] font-mono text-slate-300 leading-relaxed h-[110px] focus:outline-none resize-none"
                    />
                    <div className="absolute bottom-2.5 right-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          const txt = getPromptText(mutation, selectedSubject, promptStyle);
                          navigator.clipboard.writeText(txt);
                          setCopiedPromptName(mutation.name);
                          showToast("Промпт успешно скопирован!");
                          setTimeout(() => setCopiedPromptName(null), 2500);
                        }}
                        className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded font-mono text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                      >
                        {copiedPromptName === mutation.name ? (
                          <>
                            <Check className="w-3 h-3 stroke-[3px]" />
                            <span>СКОПИРОВАНО!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 stroke-[3px]" />
                            <span>СКОПИРОВАТЬ</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 leading-relaxed font-sans bg-slate-900/40 p-2.5 rounded border border-[#1a2c38] flex gap-2">
                  <span className="text-emerald-400 font-bold font-mono">💡</span>
                  <span>
                    Скопируйте этот промпт и вставьте его в нейросеть-генератор (например, <strong>Nano Banana</strong>, Midjourney или Stable Diffusion) для создания арта вашего персонажа!
                  </span>
                </div>

              </div>

            </div>

            {/* Quick Action Block: Add to Character */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-4 border-t border-[#1a2c38]/40 font-mono text-[11px]">
              <span className="text-slate-500">
                Чистая стоимость: {mutation.netPoints >= 0 ? "+" : ""}{mutation.netPoints} очков
              </span>

              {character.mutations.some(m => m.name === mutation.name) ? (
                <div className="flex items-center justify-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>ДОБАВЛЕНО В ЛИСТ ПЕРСОНАЖА</span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    const fullMutation = { ...mutation, id: mutation.id || Date.now().toString() };
                    setCharacter(prev => ({
                      ...prev,
                      mutations: [...prev.mutations, fullMutation]
                    }));
                    showToast("Мутация добавлена персонажу!");
                  }}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold uppercase tracking-wider rounded transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ДОБАВИТЬ ПЕРСОНАЖУ</span>
                </button>
              )}
            </div>

          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-200 flex flex-col p-4 md:p-6 border-4 border-[#0c121d] font-sans selection:bg-emerald-500 selection:text-slate-900">
      
      {/* Toast Feedback */}
      <AnimatePresence>
        {copyFeedback && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 font-bold px-6 py-3 rounded uppercase tracking-widest text-xs shadow-[0_0_25px_rgba(16,185,129,0.55)] border border-[#22c55e] flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>{copyFeedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-[#1a2c38] pb-4 mb-6 sticky top-0 bg-[#05070a]/90 backdrop-blur-md z-30 pt-2 gap-4">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.3em] text-emerald-500 font-bold mb-1">BIOLOGICAL ASSESSMENT SYSTEM</span>
          <h1 className="text-3xl font-black tracking-tighter text-white uppercase">
            БашМанаМут <span className="text-emerald-500">v4.2</span>
          </h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-6 font-mono text-xs w-full md:w-auto justify-between md:justify-end">
          <div className="text-left md:text-right">
            <div className="text-[10px] uppercase text-slate-500">SYSTEM PROFILE</div>
            <div className="text-slate-300 font-bold">GURPS 4E SPLICER</div>
          </div>
          <div className="text-left md:text-right">
            <div className="text-[10px] uppercase text-slate-500">DATABASE STATUS</div>
            <div className="text-emerald-400 font-bold">SYNCED [NO REPEAT ACTIVE]</div>
          </div>
          
          {/* Nav Tab toggles for small screens / responsive flow */}
          <div className="flex items-center gap-1 bg-[#0d141f] p-1 rounded border border-[#1a2c38]">
            <button
              onClick={() => setActiveTab("generator")}
              className={`px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${activeTab === "generator" ? "bg-emerald-500 text-slate-900 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "text-slate-400 hover:text-slate-200"}`}
            >
              Генератор
            </button>
            <button
              onClick={() => setActiveTab("presets")}
              className={`px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${activeTab === "presets" ? "bg-emerald-500 text-slate-900 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "text-slate-400 hover:text-slate-200"}`}
            >
              Шаблоны
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`relative px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${activeTab === "history" ? "bg-emerald-500 text-slate-900 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "text-slate-400 hover:text-slate-200"}`}
            >
              История
              {sessionHistory.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center border border-neutral-950 animate-pulse">
                  {sessionHistory.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("favorites")}
              className={`relative px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${activeTab === "favorites" ? "bg-emerald-500 text-slate-900 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "text-slate-400 hover:text-slate-200"}`}
            >
              Избранное
              {favorites.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-emerald-400 text-slate-950 text-[9px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center border border-neutral-950">
                  {favorites.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Interactive / Controls / Output Area (8 cols on desktop) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {activeTab === "generator" ? (
            <>
              {/* Main Panel */}
          <div className="bg-[#0d141f] border border-[#1a2c38] rounded p-6 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -z-10"></div>
            
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-[#1a2c38]">
              <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-2 font-mono">
                <Sliders className="w-4 h-4 text-emerald-500 animate-pulse" /> SPLICING PARAMETERS [КОНФИГУРАТОР]
              </h2>
              <span className="text-[10px] font-mono bg-[#1a2c38]/50 px-2 py-0.5 text-slate-400 rounded">
                SECURE_MODE_ON
              </span>
            </div>

            {/* API Key Configuration Panel */}
            <div className="mb-6 p-4 rounded border border-[#1a2c38] bg-[#090d14]/70">
              <button 
                onClick={() => setIsApiKeyPanelOpen(!isApiKeyPanelOpen)}
                className="flex items-center justify-between w-full text-left font-mono text-xs cursor-pointer hover:text-emerald-400 transition-colors focus:outline-none"
              >
                <span className="flex items-center gap-2 text-slate-300">
                  <Key className="w-3.5 h-3.5 text-emerald-500" />
                  НАСТРОЙКА ИСТОЧНИКА ИИ / API-КЛЮЧА
                </span>
                <span className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${userApiKey ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}>
                    {customProviderUrl ? `${customProviderModel || 'Custom'} АКТИВЕН` : userApiKey ? 'СВОЙ GEMINI КЛЮЧ' : 'СЕРВЕРНЫЙ GEMINI'}
                  </span>
                  {isApiKeyPanelOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </span>
              </button>
              
              {isApiKeyPanelOpen && (
                <div className="mt-4 pt-4 border-t border-[#1a2c38]/60 text-xs text-slate-300 space-y-4">
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Выберите провайдера ИИ. Все настройки сохраняются только в вашем браузере (localStorage) и передаются на сервер только для проксирования запросов.
                  </p>
                  
                  {/* Preset Selection Buttons */}
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1.5 font-bold">Предустановленные провайдеры:</label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5">
                      {[
                        { name: "Gemini", url: "", model: "" },
                        { name: "DeepSeek", url: "https://api.deepseek.com/v1", model: "deepseek-chat" },
                        { name: "OpenRouter", url: "https://openrouter.ai/api/v1", model: "google/gemini-2.5-flash" },
                        { name: "Perplexity", url: "https://api.perplexity.ai", model: "sonar-reasoning" },
                        { name: "Свой API", url: "https://api.openai.com/v1", model: "gpt-4o-mini" }
                      ].map((preset) => {
                        const isPresetActive = 
                          (preset.url === "" && tempProviderUrl === "") ||
                          (preset.url !== "" && tempProviderUrl.includes(preset.url.split("//")[1]?.split("/")[0]));
                        return (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => {
                              setTempProviderUrl(preset.url);
                              setTempProviderModel(preset.model);
                              if (preset.url === "") {
                                setTempApiKey(userApiKey && !customProviderUrl ? userApiKey : "");
                              }
                            }}
                            className={`px-2 py-1.5 rounded font-mono text-[10px] text-center border cursor-pointer font-bold transition-all ${
                              isPresetActive 
                                ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" 
                                : "bg-[#05070a]/60 border-[#1a2c38] text-slate-400 hover:text-white hover:border-slate-600"
                            }`}
                          >
                            {preset.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* API Base URL and Model Inputs if Custom / Preset OpenAI is active */}
                  {tempProviderUrl !== "" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#05070a]/40 p-3 rounded border border-[#1a2c38]/40">
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1 font-bold">API Base URL (Адрес Сервера):</label>
                        <input
                          type="text"
                          value={tempProviderUrl}
                          onChange={(e) => setTempProviderUrl(e.target.value)}
                          placeholder="https://api.deepseek.com/v1"
                          className="w-full bg-[#05070a] border border-[#1a2c38] px-2.5 py-1.5 rounded text-white font-mono placeholder-slate-700 focus:outline-none focus:border-emerald-500 transition-all text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1 font-bold">Model ID (Название Модели):</label>
                        <input
                          type="text"
                          value={tempProviderModel}
                          onChange={(e) => setTempProviderModel(e.target.value)}
                          placeholder="deepseek-chat"
                          className="w-full bg-[#05070a] border border-[#1a2c38] px-2.5 py-1.5 rounded text-white font-mono placeholder-slate-700 focus:outline-none focus:border-emerald-500 transition-all text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* API Key Input */}
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1 font-bold">
                      API-Ключ {tempProviderUrl ? 'для выбранного API' : '(Gemini API Key)'}:
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input 
                          type={showApiKey ? "text" : "password"}
                          value={tempApiKey}
                          onChange={(e) => setTempApiKey(e.target.value)}
                          placeholder={tempProviderUrl ? "sk-..." : "AIzaSy..."}
                          className="w-full bg-[#05070a] border border-[#1a2c38] px-3 py-2 rounded text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all text-xs pr-16"
                        />
                        {tempApiKey && (
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 font-mono text-[9px] uppercase font-bold cursor-pointer"
                          >
                            {showApiKey ? "Скрыть" : "Показать"}
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => handleSaveApiKey(tempApiKey, tempProviderUrl, tempProviderModel)}
                        className="px-4 py-2 bg-emerald-500 text-slate-900 rounded font-bold hover:bg-emerald-400 transition-all cursor-pointer text-xs uppercase"
                      >
                        Сохранить
                      </button>
                      {(userApiKey || customProviderUrl) && (
                        <button
                          onClick={() => {
                            setTempApiKey("");
                            setTempProviderUrl("");
                            setTempProviderModel("");
                            handleSaveApiKey("", "", "");
                          }}
                          className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded font-bold transition-all border border-rose-500/20 cursor-pointer text-xs uppercase"
                          title="Сбросить на серверный ключ"
                        >
                          Сбросить
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              
              {/* Positive target slider */}
              <div className="bg-[#05070a] p-4 rounded border border-[#1a2c38] shadow-inner">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs uppercase tracking-wider font-mono text-slate-300 flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-emerald-500" /> СИЛА ПРЕИМУЩЕСТВ
                  </span>
                  <span className="text-base font-mono font-black text-emerald-400">+{positiveTarget} PTS</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="150" 
                  step="5"
                  value={positiveTarget}
                  onChange={(e) => setPositiveTarget(parseInt(e.target.value))}
                  className="w-full h-1 bg-[#1a2c38] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[9px] text-slate-500 mt-2 font-mono">
                  <span>0 (МИНОР)</span>
                  <span>75 (СУЩЕСТВЕННО)</span>
                  <span>150 (СВЕРХСИЛА)</span>
                </div>
              </div>

              {/* Negative target slider */}
              <div className="bg-[#05070a] p-4 rounded border border-[#1a2c38] shadow-inner">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs uppercase tracking-wider font-mono text-slate-300 flex items-center gap-2">
                    <Skull className="w-3.5 h-3.5 text-rose-500" /> ШТРАФЫ / ДЕФЕКТЫ
                  </span>
                  <span className="text-base font-mono font-black text-rose-400">{negativeTarget} PTS</span>
                </div>
                <input 
                  type="range" 
                  min="-100" 
                  max="0" 
                  step="5"
                  value={negativeTarget}
                  onChange={(e) => setNegativeTarget(parseInt(e.target.value))}
                  className="w-full h-1 bg-[#1a2c38] rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
                <div className="flex justify-between text-[9px] text-slate-500 mt-2 font-mono">
                  <span>-100 (КАТАСТРОФА)</span>
                  <span>-50 (ТЯЖЕЛЫЕ)</span>
                  <span>0 (БЕЗ ДЕФЕКТОВ)</span>
                </div>
              </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 border-t border-[#1a2c38]/40 pt-6">
              {/* Target Body System select */}
              <div className="bg-[#05070a] p-4 rounded border border-[#1a2c38] shadow-inner">
                <label className="block text-[10px] uppercase tracking-wider font-mono text-slate-400 mb-2">
                  ЦЕЛЕВАЯ ЧАСТЬ ИЛИ СИСТЕМА ТЕЛА
                </label>
                <select
                  value={selectedBodySystem}
                  onChange={(e) => setSelectedBodySystem(e.target.value)}
                  className="w-full bg-[#0d141f] border border-[#1a2c38] rounded p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {BODY_SYSTEM_OPTIONS.map((sys) => (
                    <option key={sys} value={sys}>
                      {sys}
                    </option>
                  ))}
                </select>
                <p className="text-[9px] font-mono text-slate-500 mt-2">
                  {selectedBodySystem === "Случайный автовыбор" 
                    ? "ИИ выберет случайную систему, соблюдая равное распределение в сессии." 
                    : "Мутация будет целенаправленно сконцентрирована на выбранной системе."}
                </p>
              </div>

              {/* Custom Wishes text input */}
              <div className="bg-[#05070a] p-4 rounded border border-[#1a2c38] shadow-inner">
                <label className="block text-[10px] uppercase tracking-wider font-mono text-slate-400 mb-2">
                  ОСОБЫЕ ПОЖЕЛАНИЯ К ВИДУ ИЛИ СИЛЕ
                </label>
                <input
                  type="text"
                  placeholder="Например: щупальца из спины, светящиеся глаза..."
                  value={customWishes}
                  onChange={(e) => setCustomWishes(e.target.value)}
                  className="w-full bg-[#0d141f] border border-[#1a2c38] rounded p-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[9px] font-mono text-slate-500 mt-2">
                  Укажите детали мутации, чтобы направить творчество искусственного интеллекта.
                </p>
              </div>
            </div>

            {/* Theme and action button row */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
              
              {/* Theme selection */}
              <div className="flex-1">
                <label className="block text-[10px] uppercase tracking-wider font-mono text-slate-400 mb-2">ГЕНЕТИЧЕСКИЙ КЛАСС (ТЕМАТИКА)</label>
                <div className="flex flex-wrap gap-1.5">
                  {THEMES.map((theme) => (
                    <button
                      key={theme}
                      onClick={() => toggleTheme(theme)}
                      className={`px-2.5 py-1.5 rounded text-[10px] uppercase font-mono font-bold tracking-wider transition-all border ${
                        selectedThemes.includes(theme) 
                        ? "bg-emerald-500 text-slate-900 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]" 
                        : "bg-[#05070a] text-slate-400 border-[#1a2c38] hover:border-emerald-500/40 hover:bg-[#0d141f]"
                      }`}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action buttons group */}
              <div className="flex flex-wrap items-center gap-2 mt-2 lg:mt-0">
                {/* Generation Count selector */}
                <div className="flex items-center bg-[#05070a] border border-[#1a2c38] p-1 rounded h-[42px]">
                  <span className="text-[9px] font-mono text-slate-500 px-2 uppercase tracking-wider hidden sm:inline">КОЛ-ВО:</span>
                  {[1, 3, 5, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setGenerateCount(num)}
                      className={`w-8 h-8 rounded text-[10.5px] font-mono font-bold transition-all ${
                        generateCount === num
                          ? "bg-emerald-500 text-slate-950 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                          : "text-slate-400 hover:bg-[#0d141f] hover:text-emerald-400"
                      }`}
                      title={`Генерировать ${num} мутаций за раз`}
                    >
                      {num}
                    </button>
                  ))}
                </div>

                {/* Randomize values button */}
                <button
                  onClick={() => {
                    setPositiveTarget(Math.floor(Math.random() * 20) * 5 + 10);
                    setNegativeTarget(Math.floor(Math.random() * 10) * -5 - 5);
                    setSelectedThemes([THEMES[Math.floor(Math.random() * THEMES.length)]]);
                  }}
                  className="p-3 bg-[#05070a] border border-[#1a2c38] text-slate-400 hover:text-emerald-400 hover:border-emerald-500 rounded transition-all self-end md:self-auto"
                  title="Случайные параметры"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>

                {/* Generate button */}
                <button
                  onClick={() => handleGenerate()}
                  disabled={isGenerating}
                  className="relative overflow-hidden px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded uppercase tracking-widest text-[11px] shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[180px] flex-1 lg:flex-none"
                >
                  {isGenerating ? (
                    <>
                      <Dna className="w-4 h-4 animate-spin" />
                      <span>ИДЕТ СИНТЕЗ...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>СИНТЕЗИРОВАТЬ</span>
                    </>
                  )}
                </button>
              </div>

            </div>

            {/* Unique session note */}
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 bg-[#05070a] px-3 py-2 rounded border border-[#1a2c38]">
                <Info className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>АНТИ-ДУБЛИРОВАНИЕ: Аномалии не будут повторяться. В базе данных сессии: {sessionHistory.length} концепт(ов).</span>
              </div>
            </div>

          </div>
          <div className="flex-1">
            
            {/* Generating Loader overlay effect */}
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="bg-[#0d141f] border border-[#1a2c38] rounded p-12 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.03),transparent)]"></div>
                  
                  {/* Glowing atomic ring animation */}
                  <div className="w-20 h-20 relative flex items-center justify-center">
                    <div className="absolute inset-0 rounded border-2 border-dashed border-emerald-500/20 animate-spin" style={{ animationDuration: "12s" }}></div>
                    <div className="absolute w-16 h-16 rounded border border-double border-emerald-500/30 animate-spin" style={{ animationDuration: "6s" }}></div>
                    <Dna className="w-8 h-8 text-emerald-500 animate-pulse" />
                  </div>

                  <h3 className="text-base font-bold uppercase tracking-widest mt-6 mb-2 text-emerald-400 font-mono">РЕКОНСТРУКЦИЯ СТРУКТУРЫ ДНК...</h3>
                  <p className="text-xs text-slate-400 max-w-sm text-center">ИИ подбирает гармоничные преимущества и штрафы по руководству GURPS Basic Set.</p>
                  
                  <div className="mt-6 text-[10px] font-mono text-emerald-500 bg-[#05070a] px-3 py-1.5 rounded border border-[#1a2c38]">
                    SPLICING_CHROMOSOMES_ACTIVE // SYS_OP_OK
                  </div>
                </motion.div>
              ) : error ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-rose-950/10 border border-rose-500/30 rounded p-8 flex flex-col items-center text-center gap-3"
                >
                  <AlertCircle className="w-10 h-10 text-rose-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-rose-400 font-mono">Ошибка Генерации</h3>
                  <p className="text-xs text-slate-300 max-w-md">{error}</p>
                  <button 
                    onClick={() => handleGenerate()}
                    className="mt-2 px-4 py-2 bg-rose-900/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-200 rounded text-xs font-mono font-bold transition-all uppercase tracking-wider"
                  >
                    Повторить попытку
                  </button>
                </motion.div>
              ) : currentMutation ? (
                renderMutationCard(currentMutation, true)
              ) : (
                <div className="bg-[#0d141f] border border-[#1a2c38] rounded p-12 text-center text-slate-400 font-mono text-xs">
                  <p>ОТЧЕТ ОТСУТСТВУЕТ. НАЖМИТЕ "СИНТЕЗИРОВАТЬ", ЧТОБЫ НАЧАТЬ ГЕНЕРАЦИЮ.</p>
                </div>
              )}
            </AnimatePresence>

          </div>
          </>
          ) : (
            <>
              {activeTab === "presets" && (
                <div className="bg-[#0d141f] border border-[#1a2c38] rounded p-6 flex flex-col gap-4 shadow-2xl">
                  <div className="flex items-center gap-2 pb-3 border-b border-[#1a2c38]">
                    <BookOpen className="w-5 h-5 text-emerald-400 animate-pulse" />
                    <h3 className="font-bold text-white text-sm uppercase tracking-wider font-mono">Шаблоны Силы Мутантов [PRESETS]</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {CHARACTER_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => applyPreset(preset)}
                        className="w-full text-left bg-[#05070a] hover:bg-[#0d141f] border border-[#1a2c38] hover:border-emerald-500/50 p-4 rounded transition-all hover:shadow-[0_0_15px_rgba(16,185,129,0.15)] flex flex-col gap-2 group cursor-pointer"
                      >
                        <div className="flex justify-between items-center w-full">
                          <h4 className="font-bold text-xs uppercase tracking-tight text-white group-hover:text-emerald-400 transition-colors">{preset.name}</h4>
                          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-[#0d141f] px-2 py-0.5 rounded border border-[#1a2c38]">
                            +{preset.positive} / {preset.negative} PTS
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed font-sans">{preset.description}</p>
                        <div className="flex justify-between items-center w-full mt-2 pt-2 border-t border-[#1a2c38]/40">
                          <span className="text-[9px] font-mono uppercase text-slate-500">Класс: {preset.theme}</span>
                          <span className="text-[9px] font-mono text-emerald-500 font-bold uppercase group-hover:underline">Применить Шаблон →</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "history" && (
                <div className="bg-[#0d141f] border border-[#1a2c38] rounded p-6 flex flex-col gap-4 shadow-2xl">
                  <div className="flex items-center justify-between pb-3 border-b border-[#1a2c38]">
                    <div className="flex items-center gap-2">
                      <Dna className="w-5 h-5 text-emerald-400 animate-pulse" />
                      <h3 className="font-bold text-white text-sm uppercase tracking-wider font-mono">История Сессии [HISTORY]</h3>
                    </div>
                    {sessionHistory.length > 0 && (
                      <button
                        onClick={() => {
                          setSessionHistory([]);
                          showToast("История очищена");
                        }}
                        className="text-xs text-rose-400 hover:text-rose-300 underline underline-offset-2 font-mono cursor-pointer"
                      >
                        очистить всю историю
                      </button>
                    )}
                  </div>

                  {/* Action Bar for History */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-[#05070a] p-3 rounded border border-[#1a2c38]">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={exportHistory}
                        disabled={sessionHistory.length === 0}
                        className={`px-3 py-1.5 rounded border text-xs font-mono font-bold flex items-center gap-2 uppercase tracking-wide transition-all cursor-pointer ${
                          sessionHistory.length === 0
                            ? "border-slate-800 bg-[#020304] text-slate-600 cursor-not-allowed"
                            : "border-emerald-500/20 bg-[#0d141f] text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.05)]"
                        }`}
                        title="Скачать всю историю как файл JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Экспорт JSON
                      </button>

                      <label className="px-3 py-1.5 rounded border border-[#1a2c38] bg-[#0d141f] hover:bg-[#1a2c38] text-slate-300 hover:text-white text-xs font-mono font-bold flex items-center gap-2 uppercase tracking-wide transition-all cursor-pointer">
                        <Upload className="w-3.5 h-3.5 text-emerald-400" />
                        Импорт JSON
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleImportHistory}
                          className="hidden"
                        />
                      </label>

                      {/* View Mode Switcher */}
                      {sessionHistory.length > 0 && (
                        <div className="flex items-center gap-1 bg-[#0d141f] border border-[#1a2c38] p-1 rounded">
                          <button
                            onClick={() => setHistoryViewMode("compact")}
                            className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                              historyViewMode === "compact"
                                ? "bg-emerald-500 text-slate-950 font-black shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                            title="Отображение в виде сетки компактных карточек"
                          >
                            <LayoutGrid className="w-3 h-3" />
                            <span className="hidden sm:inline">Сетка</span>
                          </button>
                          <button
                            onClick={() => setHistoryViewMode("detailed")}
                            className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                              historyViewMode === "detailed"
                                ? "bg-emerald-500 text-slate-950 font-black shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                            title="Отображение в виде подробного списка с деталями GURPS"
                          >
                            <List className="w-3 h-3" />
                            <span className="hidden sm:inline">Подробно</span>
                          </button>
                        </div>
                      )}

                      {/* Expand / Collapse All (only in detailed view) */}
                      {historyViewMode === "detailed" && sessionHistory.length > 0 && (
                        <button
                          onClick={() => {
                            const anyCollapsed = sessionHistory.some(m => expandedHistoryIds[m.id || m.name] === false);
                            const nextState: Record<string, boolean> = {};
                            sessionHistory.forEach(m => {
                              nextState[m.id || m.name] = anyCollapsed;
                            });
                            setExpandedHistoryIds(nextState);
                          }}
                          className="px-2.5 py-1.5 border border-[#1a2c38] bg-[#0d141f] hover:bg-[#1a2c38] text-slate-400 hover:text-slate-200 text-[10px] font-mono uppercase rounded transition-all cursor-pointer flex items-center gap-1"
                          title="Развернуть или свернуть все подробные карточки"
                        >
                          {sessionHistory.some(m => expandedHistoryIds[m.id || m.name] === false) ? (
                            <>
                              <ChevronDown className="w-3 h-3 text-emerald-400" />
                              <span>Развернуть все</span>
                            </>
                          ) : (
                            <>
                              <ChevronUp className="w-3 h-3 text-rose-400" />
                              <span>Свернуть все</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="text-[10px] font-mono text-slate-500 uppercase">
                      Всего записей: <span className="text-emerald-400 font-bold">{sessionHistory.length}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {sessionHistory.length === 0 ? (
                      <div className="text-center p-12 bg-[#05070a] rounded border border-dashed border-[#1a2c38] text-xs font-mono text-slate-500 italic">
                        История пуста. Перейдите в Генератор и сгенерируйте мутацию.
                      </div>
                    ) : historyViewMode === "compact" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sessionHistory.map((m, idx) => {
                          const isFav = isMutationFavorited(m);
                          return (
                            <div 
                              key={m.id || m.name || idx}
                              onClick={() => {
                                setCurrentMutation(m);
                                setActiveTab("generator");
                              }}
                              className={`w-full text-left bg-[#05070a] hover:bg-[#0d141f] border p-4 rounded transition-all cursor-pointer flex justify-between items-center group ${
                                currentMutation?.name === m.name ? "border-emerald-500/40 bg-emerald-950/10" : "border-[#1a2c38] hover:border-emerald-500/30"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-[9px] font-mono uppercase bg-[#0d141f] border border-[#1a2c38] px-1.5 py-0.2 rounded text-emerald-400">
                                    {m.theme}
                                  </span>
                                  {m.bodySystem && (
                                    <span className="text-[9px] font-mono uppercase bg-sky-950/40 border border-sky-500/20 px-1.5 py-0.2 rounded text-sky-400">
                                      {m.bodySystem}
                                    </span>
                                  )}
                                  <span className="text-[9px] font-mono text-slate-400">
                                    ({m.netPoints >= 0 ? "+" : ""}{m.netPoints} PTS)
                                  </span>
                                </div>
                                <h4 className="font-bold text-sm text-white uppercase tracking-tight truncate group-hover:text-emerald-400 transition-colors">{m.name}</h4>
                                <p className="text-xs text-slate-400 truncate mt-1 font-sans">{m.description}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-3">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFavorite(m);
                                  }}
                                  className={`p-2 rounded border transition-all cursor-pointer ${
                                    isFav 
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]" 
                                      : "bg-[#05070a] border-[#1a2c38] text-slate-400 hover:text-emerald-400"
                                  }`}
                                  title={isFav ? "Удалить из избранного" : "Добавить в избранное"}
                                >
                                  <Star className={`w-4 h-4 ${isFav ? "fill-emerald-400 text-emerald-400" : ""}`} />
                                </button>
                                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 transition-colors shrink-0" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-6">
                        {sessionHistory.map((m, idx) => {
                          const itemId = m.id || m.name;
                          const isExpanded = expandedHistoryIds[itemId] !== false;
                          return renderMutationCard(
                            m,
                            isExpanded,
                            () => {
                              setExpandedHistoryIds(prev => ({
                                ...prev,
                                [itemId]: !isExpanded
                              }));
                            },
                            true, // showDeleteButton
                            () => {
                              setSessionHistory(prev => prev.filter((_, i) => i !== idx));
                              showToast("Мутация удалена из истории");
                            }
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "favorites" && (
                <div className="bg-[#0d141f] border border-[#1a2c38] rounded p-6 flex flex-col gap-4 shadow-2xl">
                  <div className="flex items-center justify-between pb-3 border-b border-[#1a2c38]">
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-emerald-400 animate-pulse" />
                      <h3 className="font-bold text-white text-sm uppercase tracking-wider font-mono">Избранные Мутации [FAVORITES]</h3>
                    </div>
                    {favorites.length > 0 && (
                      <button
                        onClick={() => {
                          setFavorites([]);
                          showToast("Избранное очищено");
                        }}
                        className="text-xs text-rose-400 hover:text-rose-300 underline underline-offset-2 font-mono cursor-pointer"
                      >
                        очистить избранное
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {favorites.length === 0 ? (
                      <div className="text-center p-12 bg-[#05070a] rounded border border-dashed border-[#1a2c38] text-xs font-mono text-slate-500 italic">
                        Избранных мутаций нет. Нажмите звездочку в генераторе, чтобы сохранить мутацию в избранное.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {favorites.map((m, idx) => (
                          <div 
                            key={idx}
                            onClick={() => {
                              setCurrentMutation(m);
                              setActiveTab("generator");
                            }}
                            className={`w-full text-left bg-[#05070a] hover:bg-[#0d141f] border p-4 rounded transition-all cursor-pointer flex justify-between items-center group ${
                              currentMutation?.name === m.name ? "border-emerald-500/40 bg-emerald-950/10" : "border-[#1a2c38] hover:border-emerald-500/30"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[9px] font-mono uppercase bg-[#0d141f] border border-[#1a2c38] px-1.5 py-0.2 rounded text-emerald-400">
                                  {m.theme}
                                </span>
                                <span className="text-[9px] font-mono text-slate-400">
                                  ({m.netPoints >= 0 ? "+" : ""}{m.netPoints} PTS)
                                </span>
                              </div>
                              <h4 className="font-bold text-sm text-white uppercase tracking-tight truncate group-hover:text-emerald-400 transition-colors">{m.name}</h4>
                              <p className="text-xs text-slate-400 truncate mt-1 font-sans">{m.description}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(m);
                                }}
                                className="p-2 rounded border border-rose-500/20 bg-[#05070a] text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/40 transition-all cursor-pointer shadow-[0_0_6px_rgba(244,63,94,0.1)]"
                                title="Удалить из избранного"
                              >
                                <Star className="w-4 h-4 fill-rose-400 text-rose-400" />
                              </button>
                              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 transition-colors shrink-0" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Right Panel: Mutant Card & Session History (4 cols on desktop) */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* Active Tab for Mobile / responsive display */}
          <div className="flex flex-col gap-6">
            
            {/* 1. CHARACTER PANEL (Saves and aggregates everything) */}
            <div className="bg-[#0d141f] border border-[#1a2c38] rounded p-5 flex flex-col gap-4 shadow-2xl">
              
              <div className="flex items-center justify-between pb-3 border-b border-[#1a2c38]">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-white text-sm uppercase tracking-wider font-mono">Лист Мутанта (Character)</h3>
                </div>
                
                {character.mutations.length > 0 && (
                  <button
                    onClick={exportCharacterToText}
                    className="p-1.5 bg-[#05070a] text-emerald-400 hover:text-slate-950 hover:bg-emerald-400 rounded border border-[#1a2c38] transition-all"
                    title="Экспортировать лист персонажа"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Character Profile / Name editing */}
              <div className="bg-[#05070a] p-4 rounded border border-[#1a2c38]">
                {isEditingCharName ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="text"
                      value={tempCharName}
                      onChange={(e) => setTempCharName(e.target.value)}
                      maxLength={32}
                      className="bg-[#0d141f] border border-[#1a2c38] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 flex-1 font-mono"
                    />
                    <button 
                      onClick={saveCharacterName}
                      className="px-3 py-1.5 bg-emerald-500 text-slate-950 rounded text-xs font-mono font-bold hover:bg-emerald-400"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between group">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono block mb-0.5">Имя Персонажа</span>
                      <h4 className="font-bold text-white text-sm uppercase tracking-tight">{character.name}</h4>
                    </div>
                    <button 
                      onClick={() => setIsEditingCharName(true)}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 underline underline-offset-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity font-mono"
                    >
                      изменить
                    </button>
                  </div>
                )}

                {/* Total Stats Banner */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-[#1a2c38]/50 text-center">
                  <div className="bg-[#0d141f] p-2 rounded border border-[#1a2c38]">
                    <span className="text-[9px] uppercase font-mono text-slate-400 block">Плюсы</span>
                    <strong className="text-xs font-mono text-emerald-400">+{totalAdvantages}</strong>
                  </div>
                  <div className="bg-rose-950/10 p-2 rounded border border-rose-900/20">
                    <span className="text-[9px] uppercase font-mono text-slate-400 block">Минусы</span>
                    <strong className="text-xs font-mono text-rose-400">{totalDisadvantages}</strong>
                  </div>
                  <div className="bg-[#0d141f] p-2 rounded border border-[#1a2c38]">
                    <span className="text-[9px] uppercase font-mono text-slate-400 block">Баланс</span>
                    <strong className={`text-xs font-mono ${totalNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {totalNet >= 0 ? "+" : ""}{totalNet}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Saved Mutations List */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {character.mutations.length === 0 ? (
                  <div className="text-center p-6 bg-[#05070a] rounded border border-dashed border-[#1a2c38] text-[10px] font-mono text-slate-500 italic">
                    Персонаж пока не мутировал. Сгенерируйте мутацию и добавьте ее сюда!
                  </div>
                ) : (
                  character.mutations.map((m) => (
                    <div 
                      key={m.id} 
                      className="bg-[#05070a] hover:bg-[#0d141f] border border-[#1a2c38] p-3 rounded flex items-center justify-between gap-2 group transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[9px] font-mono uppercase bg-[#0d141f] border border-[#1a2c38] px-1.5 py-0.2 rounded text-emerald-400">
                            {m.theme}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">
                            ({m.netPoints >= 0 ? "+" : ""}{m.netPoints} PTS)
                          </span>
                        </div>
                        <h5 className="font-bold text-xs text-white truncate uppercase tracking-tight">{m.name}</h5>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyMutationToClipboard(m)}
                          className="p-1.5 hover:bg-[#0d141f] rounded text-slate-400 hover:text-emerald-400 transition-all"
                          title="Скопировать"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeMutationFromCharacter(m.id)}
                          className="p-1.5 hover:bg-rose-950/20 rounded text-slate-400 hover:text-rose-400 transition-all"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>

            {/* Reference Guide */}
            <div className="bg-[#05070a] border border-[#1a2c38] p-4 rounded flex flex-col gap-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Info className="w-4 h-4 text-emerald-400" /> Подсказка для GURPS 4e
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Итоговая стоимость преимуществ рассчитывается путем суммирования процентов ограничений и улучшений и последующего умножения на базовую стоимость. Ограничение <span className="text-emerald-400 font-mono">"Мутация (-10%)"</span> часто накладывается на мутагенные способности по умолчанию.
              </p>
            </div>

          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#1a2c38] bg-[#05070a] py-6 px-4 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© 2026 GURPS Mutant DNA Splicer Engine. Лицензировано под Creative Commons.</p>
          <div className="flex gap-4">
            <span className="text-slate-600">GURPS® is a registered trademark of Steve Jackson Games.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
