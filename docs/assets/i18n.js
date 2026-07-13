(() => {
  const STORAGE_KEY = 'aceitaTempo_docs_lang';
  const SUPPORTED = ['pt-BR', 'en'];

  const STRINGS = {
    'pt-BR': {
      _title_index: 'AceitaTempo: veja o pedaço do seu mês que cada compra consome',
      _desc_index: 'AceitaTempo transforma preços em horas de trabalho enquanto você navega. Disponível para Chrome e Firefox.',
      _title_support: 'AceitaTempo: Suporte',
      _desc_support: 'Página de suporte do AceitaTempo para Chrome e Firefox. Reporte bugs, sites sem cobertura e dúvidas de configuração.',
      _title_privacy: 'AceitaTempo: Política de Privacidade',
      _desc_privacy: 'Política de privacidade do AceitaTempo com resumo dos dados usados, tratamento local no navegador e consulta opcional de câmbio.',

      langAuto: 'Automático',
      langPt: 'Português',
      langEn: 'English',
      langLabel: 'Idioma',
      menuLabel: 'Menu',
      menuClose: 'Fechar',
      brandAria: 'AceitaTempo',
      navHome: 'Início',
      navHow: 'Como funciona',
      navFeatures: 'Recursos',
      navStores: 'Lojas',
      navPrivacy: 'Privacidade',
      navSupport: 'Suporte',
      navInstall: 'Instalar',
      installChrome: 'Instalar no Chrome',
      installFirefox: 'Instalar no Firefox',
      footerText: 'AceitaTempo: extensão para Chrome e Firefox que converte preços em horas de trabalho.',
      footerPrivacy: 'Privacidade',
      footerSupport: 'Suporte',

      heroEyebrow: 'Extensão para Chrome e Firefox',
      heroTitle: 'Pare de olhar só para o preço.',
      heroLead: 'O <strong>AceitaTempo</strong> transforma valores em horas de trabalho enquanto você navega. Em páginas de produto, listagens e checkout, cada preço vira uma medida do seu tempo: <strong>quanto da sua vida aquela compra realmente custa?</strong>',
      heroBrowsersAria: 'Navegadores compatíveis',
      heroShotAlt: 'Captura real do AceitaTempo mostrando badges de tempo ao lado de preços em uma listagem de produtos',
      heroCaption: 'Exemplo real: memórias RAM com o tempo de trabalho ao lado de cada preço.',

      howEyebrow: 'Como funciona',
      howTitle: 'Três passos para colocar o seu tempo na conversa.',
      howSubtitle: 'Sem planilha, sem calculadora e sem mudar sua rotina. Você configura uma vez e a extensão faz o resto.',
      step1Title: 'Defina seu valor-hora',
      step1Body: 'Informe salário, moeda e horas trabalhadas por mês. O AceitaTempo calcula a referência usada nas conversões.',
      step2Title: 'Navegue normalmente',
      step2Body: 'Abra páginas de produto, listagens e checkout. A extensão identifica os preços suportados sem virar ruído visual.',
      step3Title: 'Leia o custo real',
      step3Body: 'Os valores ganham badges, detalhes no hover e, se quiser, podem ser substituídos pelo tempo de trabalho correspondente.',

      featuresEyebrow: 'Recursos',
      featuresTitle: 'A clareza vem do cálculo. A confiança vem do controle.',
      featuresSubtitle: 'Configure seu valor-hora, acompanhe os preços convertidos e ajuste a extensão do jeito que fizer sentido para a sua rotina.',
      feat1Title: 'Badge curto, leitura rápida',
      feat1Body: 'O tempo aparece ao lado do preço sem quebrar cards e sem competir com o layout da loja.',
      feat2Title: 'Produto, listagem e checkout',
      feat2Body: 'O contexto não some quando a decisão esquenta: acompanha desde a vitrine até o valor final do pedido.',
      feat3Title: 'Privacidade por padrão',
      feat3Body: 'Preferências ficam no navegador. O cálculo acontece localmente, sem backend próprio coletando seus dados.',
      feat4Title: 'BRL ou USD, câmbio auto ou manual',
      feat4Body: 'O cálculo se adapta ao seu cenário, com flexibilidade para ajustar a taxa de conversão do jeito que fizer sentido.',
      feat5Title: 'Modo badge ou substituição total',
      feat5Body: 'Se quiser radicalizar a percepção, você pode esconder o preço e deixar só o tempo necessário para comprar.',
      feat6Title: 'Controle por site',
      feat6Body: 'Ative sites externos quando fizer sentido, desligue lojas específicas e mantenha a experiência sob medida.',

      storesEyebrow: 'Cobertura',
      storesTitle: 'Funciona onde a tentação costuma aparecer.',
      storesSubtitle: 'Marketplaces, varejo, games e outros cenários compatíveis mostram o custo em tempo no momento da compra.',

      privacyEyebrow: 'Privacidade e transparência',
      privacyTitle: 'Seu contexto financeiro não precisa sair do navegador para ser útil.',
      privacyBody: 'Os dados ficam no navegador, o cálculo acontece localmente, as sessões sociais opcionais são temporárias e a extensão só consulta a taxa USD/BRL quando o câmbio automático está ativo.',
      privItem1: 'Preferências salvas via chrome.storage',
      privItem2: 'Processamento local dos preços',
      privItem3: 'Sessões sociais em storage local temporário',
      privItem4: 'Consulta externa apenas para taxa USD/BRL',
      privItem5: 'Sem backend próprio nem coleta comercial',

      supportEyebrow: 'Suporte',
      supportHeroTitle: 'Precisa de ajuda com o AceitaTempo?',
      supportHeroBody: 'Se um site não estiver sendo convertido, se algo parecer quebrado ou se você tiver dúvida sobre configuração, aqui estão os caminhos mais rápidos para resolver.',
      supportActionGithub: 'Abrir issue no GitHub',
      supportActionBack: 'Voltar para a página inicial',
      supportCard1Title: 'Site sem badge?',
      supportCard1Body: 'Envie a URL da página, um print do preço e, se puder, o trecho de HTML correspondente.',
      supportCard2Title: 'Bug visual?',
      supportCard2Body: 'Informe a página exata, o tamanho da janela e o que deveria aparecer para facilitar a reprodução.',
      supportCard3Title: 'Dúvida nas opções?',
      supportCard3Body: 'Vale enviar também como seu salário, moeda e horas mensais estão configurados nas opções.',
      supportFaq1Title: 'Por que não aparece em um site específico?',
      supportFaq1Body: 'Alguns sites mudam o layout com frequência ou carregam preços de forma dinâmica. Um print do trecho do preço costuma acelerar bastante a correção.',
      supportFaq2Title: 'Como desativo em um site?',
      supportFaq2Body: 'Abra as opções da extensão e ajuste o comportamento por site. Se a loja estiver listada, você pode desligá-la manualmente.',
      supportFaq3Title: 'Onde ficam as configurações?',
      supportFaq3Body: 'As preferências ficam no chrome.storage do navegador. Dependendo da sua conta, elas podem sincronizar entre dispositivos.',
      supportFaq4Title: 'O que enviar em um reporte?',
      supportFaq4Body: 'URL, print da página, resolução da janela e uma descrição curta do que deveria acontecer já ajudam muito.',
      supportNotice: 'Se o problema estiver em um carrinho ou checkout, inclua também o total exibido na página. Isso ajuda a validar se o cálculo foi aplicado no bloco certo.',
      supportProjectTitle: 'Projeto',
      supportProjectLink: 'Abrir repositório no GitHub',
      supportReportTitle: 'Reporte',
      supportReportLink: 'Abrir issue de suporte',
      supportPrivacyCardTitle: 'Privacidade',
      supportPrivacyCardLink: 'Ler a política de privacidade',
      supportExtTitle: 'Extensão',
      supportExtChrome: 'Chrome Web Store',
      supportExtFirefox: 'Firefox Add-ons',

      ppEyebrow: 'Privacidade',
      ppHeroTitle: 'Política de Privacidade do AceitaTempo',
      ppHeroBody: 'O AceitaTempo foi projetado para calcular tudo no próprio navegador sempre que possível. Esta página resume quais dados entram no cálculo e como eles são tratados.',
      ppActionSupport: 'Ir para o suporte',
      ppActionHome: 'Voltar para a página inicial',
      ppFact1Value: 'Local no navegador',
      ppFact1Body: 'Salário, horas trabalhadas, preferências e snapshots temporários da feature social ficam salvos no chrome.storage.',
      ppFact2Value: 'Sem backend próprio',
      ppFact2Body: 'O projeto não mantém servidor para armazenar ou comercializar dados de navegação.',
      ppFact3Value: 'Câmbio opcional',
      ppFact3Body: 'A consulta externa acontece apenas para taxa USD/BRL quando o modo automático está ativo.',
      ppFact4Value: 'Afiliação transparente',
      ppFact4Body: 'Links afiliados são sugeridos apenas em lojas parceiras e só abrem quando você clica no botão de apoio.',
      ppDataEyebrow: 'Dados usados',
      ppDataTitle: 'O necessário para calcular o tempo de trabalho',
      ppDataSubtitle: 'Nada além do que for preciso para converter preços e respeitar as preferências definidas por você.',
      ppDataCard1Title: 'Configurações informadas por você',
      ppDataCard1Item1: 'Salário mensal',
      ppDataCard1Item2: 'Horas trabalhadas por mês',
      ppDataCard1Item3: 'Moeda selecionada',
      ppDataCard2Title: 'Preferências de comportamento',
      ppDataCard2Item1: 'Substituir ou não preços por horas',
      ppDataCard2Item2: 'Modo de câmbio automático ou manual',
      ppDataCard2Item3: 'Ativação ou desativação por site',
      ppDataCard2Item4: 'Check-ins opcionais em redes sociais e conversão monetária opt-in',
      ppDataCard3Title: 'Conteúdo visível da página',
      ppDataCard3Item1: 'Preços exibidos',
      ppDataCard3Item2: 'Totais de carrinho ou checkout',
      ppDataCard3Item3: 'Contexto necessário para identificar o bloco correto',
      ppDataCard4Title: 'Taxa USD/BRL',
      ppDataCard4Item1: 'Consultada apenas no modo automático',
      ppDataCard4Item2: 'Fonte atual: <a href="https://open.er-api.com/" rel="noreferrer noopener" target="_blank">open.er-api.com</a>',
      ppDataCard5Title: 'Sessões sociais opcionais',
      ppDataCard5Item1: 'Guardam apenas tempo ativo, site monitorado e anotação opcional',
      ppDataCard5Item2: 'Ficam em chrome.storage.local para retomar um resumo discreto ao voltar ao site',
      ppDataCard5Item3: 'São temporárias e removidas após a reflexão final ou depois de 24 horas',
      ppDataCard6Title: 'Apoio afiliado e Pix',
      ppDataCard6Item1: 'Amazon, Mercado Livre e Instant Gaming usam códigos afiliados ativos nesta versão',
      ppDataCard6Item2: 'AliExpress e Shopee ficam desativados até existir integração oficial adequada',
      ppDataCard6Item3: 'O QR Code Pix é opcional e não transmite dados para o AceitaTempo',
      ppTreatmentEyebrow: 'Tratamento dos dados',
      ppTreatmentTitle: 'Como essas informações são usadas',
      ppTreatmentSubtitle: 'O foco da extensão é calcular e exibir o equivalente em horas de trabalho, sem depender de infraestrutura própria.',
      ppTreatment1Title: 'Armazenamento',
      ppTreatment1Body: 'As preferências ficam salvas no navegador para que o cálculo continue consistente entre páginas e sessões. Se você ativar a feature social, snapshots temporários locais ajudam a retomar a reflexão final.',
      ppTreatment2Title: 'Processamento',
      ppTreatment2Body: 'O conteúdo visível é processado localmente para localizar preços, entender contexto e gerar a conversão em horas. Nas redes sociais opcionais, a extensão mede apenas tempo ativo e o alinhamento informado por você.',
      ppTreatment3Title: 'Compartilhamento',
      ppTreatment3Body: 'O AceitaTempo não vende dados, não usa analytics próprios e não compartilha conteúdo das páginas para fins comerciais.',
      ppTreatment4Title: 'Afiliação e Pix',
      ppTreatment4Body: 'Quando você escolhe apoiar por link afiliado, a extensão monta o link localmente e abre a loja parceira. No Pix, o pagamento acontece no seu app bancário.',
      ppNotice: 'Se o modo automático de câmbio estiver desativado, não há consulta externa de taxa USD/BRL. Links afiliados só são abertos por clique explícito no botão de apoio.',
      ppContactEyebrow: 'Contato',
      ppContactTitle: 'Dúvidas sobre privacidade ou suporte?',
      ppContactSubtitle: 'Se você precisar de ajuda adicional, use os canais abaixo.',
      ppContactSupportTitle: 'Suporte',
      ppContactSupportLink: 'Abrir página de suporte',
      ppContactExtTitle: 'Extensão',
      ppContactExtChrome: 'Chrome Web Store',
      ppContactExtFirefox: 'Firefox Add-ons',
      ppContactRepoTitle: 'Repositório',
      ppContactRepoLink: 'Abrir repositório no GitHub',
      ppContactUpdateTitle: 'Atualização desta política',
      ppContactUpdateBody: 'Última atualização: 19 de março de 2026.',
    },

    en: {
      _title_index: 'AceitaTempo: see the slice of your month each purchase consumes',
      _desc_index: 'AceitaTempo turns prices into work hours as you browse. Available for Chrome and Firefox.',
      _title_support: 'AceitaTempo: Support',
      _desc_support: 'Support page for AceitaTempo on Chrome and Firefox. Report bugs, missing site coverage and configuration questions.',
      _title_privacy: 'AceitaTempo: Privacy Policy',
      _desc_privacy: 'Privacy policy for AceitaTempo with a summary of data used, local browser processing and optional exchange-rate lookup.',

      langAuto: 'Automatic',
      langPt: 'Portuguese',
      langEn: 'English',
      langLabel: 'Language',
      menuLabel: 'Menu',
      menuClose: 'Close',
      brandAria: 'AceitaTempo',
      navHome: 'Home',
      navHow: 'How it works',
      navFeatures: 'Features',
      navStores: 'Stores',
      navPrivacy: 'Privacy',
      navSupport: 'Support',
      navInstall: 'Install',
      installChrome: 'Install on Chrome',
      installFirefox: 'Install on Firefox',
      footerText: 'AceitaTempo: Chrome and Firefox extension that converts prices into work hours.',
      footerPrivacy: 'Privacy',
      footerSupport: 'Support',

      heroEyebrow: 'Extension for Chrome and Firefox',
      heroTitle: 'Stop looking only at the price.',
      heroLead: '<strong>AceitaTempo</strong> turns prices into work hours as you browse. On product pages, listings and checkout, every price becomes a measure of your time: <strong>how much of your life does that purchase really cost?</strong>',
      heroBrowsersAria: 'Compatible browsers',
      heroShotAlt: 'Real screenshot of AceitaTempo showing work-time badges next to prices in a product listing',
      heroCaption: 'Real example: RAM modules with work time shown next to each price.',

      howEyebrow: 'How it works',
      howTitle: 'Three steps to put your time in the conversation.',
      howSubtitle: 'No spreadsheet, no calculator and no change to your routine. You set it up once and the extension does the rest.',
      step1Title: 'Set your hourly value',
      step1Body: 'Enter your salary, currency and monthly work hours. AceitaTempo calculates the reference used for conversions.',
      step2Title: 'Browse normally',
      step2Body: 'Open product pages, listings and checkout. The extension identifies supported prices without becoming visual noise.',
      step3Title: 'Read the real cost',
      step3Body: 'Prices get badges, hover details and, if you want, can be replaced by the corresponding work time.',

      featuresEyebrow: 'Features',
      featuresTitle: 'Clarity comes from the math. Trust comes from control.',
      featuresSubtitle: 'Set your hourly value, track converted prices and tune the extension to fit your routine.',
      feat1Title: 'Short badge, quick read',
      feat1Body: 'The time appears next to the price without breaking cards or competing with the store layout.',
      feat2Title: 'Product, listing and checkout',
      feat2Body: 'The context does not vanish when the decision heats up: it follows from the showcase to the final order total.',
      feat3Title: 'Privacy by default',
      feat3Body: 'Preferences stay in your browser. The calculation runs locally, with no own backend collecting your data.',
      feat4Title: 'BRL or USD, auto or manual rate',
      feat4Body: 'The calculation adapts to your scenario, with flexibility to adjust the conversion rate as it makes sense.',
      feat5Title: 'Badge mode or full replacement',
      feat5Body: 'If you want to push the perception further, you can hide the price and show only the work time needed to buy.',
      feat6Title: 'Per-site control',
      feat6Body: 'Enable external sites when it makes sense, turn off specific stores and keep the experience tailored to you.',

      storesEyebrow: 'Coverage',
      storesTitle: 'Works where temptation tends to show up.',
      storesSubtitle: 'Marketplaces, retail, games and other compatible scenarios show the cost in time at the moment of purchase.',

      privacyEyebrow: 'Privacy and transparency',
      privacyTitle: 'Your financial context does not need to leave the browser to be useful.',
      privacyBody: 'Data stays in the browser, the calculation runs locally, optional social sessions are temporary and the extension only queries the USD/BRL rate when automatic exchange is enabled.',
      privItem1: 'Preferences saved via chrome.storage',
      privItem2: 'Local price processing',
      privItem3: 'Social sessions in temporary local storage',
      privItem4: 'External query only for USD/BRL rate',
      privItem5: 'No own backend or commercial data collection',

      supportEyebrow: 'Support',
      supportHeroTitle: 'Need help with AceitaTempo?',
      supportHeroBody: 'If a site is not being converted, if something looks broken or if you have a configuration question, here are the fastest ways to sort it out.',
      supportActionGithub: 'Open a GitHub issue',
      supportActionBack: 'Back to the home page',
      supportCard1Title: 'Site without a badge?',
      supportCard1Body: 'Send the page URL, a screenshot of the price and, if possible, the corresponding HTML snippet.',
      supportCard2Title: 'Visual bug?',
      supportCard2Body: 'Report the exact page, window size and what should appear to make reproduction easier.',
      supportCard3Title: 'Question about options?',
      supportCard3Body: 'It helps to also send how your salary, currency and monthly hours are configured in the options.',
      supportFaq1Title: 'Why does it not show up on a specific site?',
      supportFaq1Body: 'Some sites change their layout frequently or load prices dynamically. A screenshot of the price area usually speeds up the fix.',
      supportFaq2Title: 'How do I disable it on a site?',
      supportFaq2Body: 'Open the extension options and adjust the behavior per site. If the store is listed, you can turn it off manually.',
      supportFaq3Title: 'Where are the settings stored?',
      supportFaq3Body: 'Preferences are stored in the browser chrome.storage. Depending on your account, they may sync across devices.',
      supportFaq4Title: 'What to include in a report?',
      supportFaq4Body: 'URL, page screenshot, window resolution and a short description of what should happen already help a lot.',
      supportNotice: 'If the issue is in a cart or checkout, also include the total shown on the page. That helps validate whether the calculation was applied to the right block.',
      supportProjectTitle: 'Project',
      supportProjectLink: 'Open repository on GitHub',
      supportReportTitle: 'Report',
      supportReportLink: 'Open a support issue',
      supportPrivacyCardTitle: 'Privacy',
      supportPrivacyCardLink: 'Read the privacy policy',
      supportExtTitle: 'Extension',
      supportExtChrome: 'Chrome Web Store',
      supportExtFirefox: 'Firefox Add-ons',

      ppEyebrow: 'Privacy',
      ppHeroTitle: 'AceitaTempo Privacy Policy',
      ppHeroBody: 'AceitaTempo is designed to calculate everything in the browser whenever possible. This page summarizes which data goes into the calculation and how it is handled.',
      ppActionSupport: 'Go to support',
      ppActionHome: 'Back to the home page',
      ppFact1Value: 'Local in the browser',
      ppFact1Body: 'Salary, work hours, preferences and temporary snapshots of the social feature are stored in chrome.storage.',
      ppFact2Value: 'No own backend',
      ppFact2Body: 'The project does not maintain a server to store or commercialize browsing data.',
      ppFact3Value: 'Optional exchange rate',
      ppFact3Body: 'The external query only happens for the USD/BRL rate when automatic mode is enabled.',
      ppFact4Value: 'Transparent affiliate',
      ppFact4Body: 'Affiliate links are suggested only on partner stores and only open when you click the support button.',
      ppDataEyebrow: 'Data used',
      ppDataTitle: 'What is needed to calculate work time',
      ppDataSubtitle: 'Nothing beyond what is required to convert prices and respect the preferences you set.',
      ppDataCard1Title: 'Settings you provide',
      ppDataCard1Item1: 'Monthly salary',
      ppDataCard1Item2: 'Hours worked per month',
      ppDataCard1Item3: 'Selected currency',
      ppDataCard2Title: 'Behavior preferences',
      ppDataCard2Item1: 'Whether to replace prices with hours',
      ppDataCard2Item2: 'Automatic or manual exchange mode',
      ppDataCard2Item3: 'Per-site enable or disable',
      ppDataCard2Item4: 'Optional social check-ins and opt-in monetary conversion',
      ppDataCard3Title: 'Visible page content',
      ppDataCard3Item1: 'Displayed prices',
      ppDataCard3Item2: 'Cart or checkout totals',
      ppDataCard3Item3: 'Context needed to identify the correct block',
      ppDataCard4Title: 'USD/BRL rate',
      ppDataCard4Item1: 'Queried only in automatic mode',
      ppDataCard4Item2: 'Current source: <a href="https://open.er-api.com/" rel="noreferrer noopener" target="_blank">open.er-api.com</a>',
      ppDataCard5Title: 'Optional social sessions',
      ppDataCard5Item1: 'Store only active time, monitored site and optional note',
      ppDataCard5Item2: 'Stored in chrome.storage.local to resume a discreet summary when returning to the site',
      ppDataCard5Item3: 'Temporary and removed after the final reflection or after 24 hours',
      ppDataCard6Title: 'Affiliate support and Pix',
      ppDataCard6Item1: 'Amazon, Mercado Livre and Instant Gaming use active affiliate codes in this version',
      ppDataCard6Item2: 'AliExpress and Shopee stay disabled until a proper official integration exists',
      ppDataCard6Item3: 'The Pix QR Code is optional and does not transmit data to AceitaTempo',
      ppTreatmentEyebrow: 'Data handling',
      ppTreatmentTitle: 'How this information is used',
      ppTreatmentSubtitle: 'The focus of the extension is to calculate and display the equivalent in work hours, without relying on its own infrastructure.',
      ppTreatment1Title: 'Storage',
      ppTreatment1Body: 'Preferences are saved in the browser so the calculation stays consistent across pages and sessions. If you enable the social feature, temporary local snapshots help resume the final reflection.',
      ppTreatment2Title: 'Processing',
      ppTreatment2Body: 'Visible content is processed locally to find prices, understand context and generate the conversion into hours. On optional social networks, the extension only measures active time and the alignment you report.',
      ppTreatment3Title: 'Sharing',
      ppTreatment3Body: 'AceitaTempo does not sell data, does not use its own analytics and does not share page content for commercial purposes.',
      ppTreatment4Title: 'Affiliate and Pix',
      ppTreatment4Body: 'When you choose to support via an affiliate link, the extension builds the link locally and opens the partner store. With Pix, the payment happens in your banking app.',
      ppNotice: 'If automatic exchange mode is disabled, there is no external USD/BRL rate query. Affiliate links are only opened by an explicit click on the support button.',
      ppContactEyebrow: 'Contact',
      ppContactTitle: 'Questions about privacy or support?',
      ppContactSubtitle: 'If you need additional help, use the channels below.',
      ppContactSupportTitle: 'Support',
      ppContactSupportLink: 'Open support page',
      ppContactExtTitle: 'Extension',
      ppContactExtChrome: 'Chrome Web Store',
      ppContactExtFirefox: 'Firefox Add-ons',
      ppContactRepoTitle: 'Repository',
      ppContactRepoLink: 'Open repository on GitHub',
      ppContactUpdateTitle: 'Update to this policy',
      ppContactUpdateBody: 'Last updated: March 19, 2026.',
    },
  };

  function detectLang() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'auto' || stored === 'pt-BR' || stored === 'en') {
      if (stored === 'auto') {
        return /^pt/i.test(navigator.language) ? 'pt-BR' : 'en';
      }
      return stored;
    }
    return /^pt/i.test(navigator.language) ? 'pt-BR' : 'en';
  }

  function getStoredPref() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'pt-BR' || stored === 'en' || stored === 'auto') return stored;
    return 'auto';
  }

  function t(key) {
    const lang = detectLang();
    return STRINGS[lang]?.[key] ?? STRINGS['pt-BR']?.[key] ?? key;
  }

  function applyTranslations() {
    const lang = detectLang();
    const dict = STRINGS[lang] || STRINGS['pt-BR'];

    document.documentElement.lang = lang === 'pt-BR' ? 'pt-BR' : 'en';

    const titleEl = document.querySelector('title');
    if (titleEl && titleEl.dataset.i18n) {
      titleEl.textContent = dict[titleEl.dataset.i18n] || titleEl.textContent;
    }

    document.querySelectorAll('meta[name="description"][data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) el.setAttribute('content', dict[key]);
    });

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!dict[key]) return;
      if (el.hasAttribute('data-i18n-html')) {
        el.innerHTML = dict[key];
      } else {
        el.textContent = dict[key];
      }
    });

    document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria-label');
      if (dict[key]) el.setAttribute('aria-label', dict[key]);
    });

    document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
      const key = el.getAttribute('data-i18n-alt');
      if (dict[key]) el.setAttribute('alt', dict[key]);
    });

    const sel = document.getElementById('lang-select');
    if (sel) syncDropdown(sel);

    updateStoreUrls(lang);
  }

  function updateStoreUrls(lang) {
    const hl = lang === 'pt-BR' ? 'pt-BR' : 'en';
    document.querySelectorAll('a[href*="chromewebstore.google.com"]').forEach((a) => {
      a.href = a.href.replace(/hl=[^&]+/, 'hl=' + hl);
    });
  }

  function setLang(pref) {
    localStorage.setItem(STORAGE_KEY, pref);
    applyTranslations();
    document.dispatchEvent(new CustomEvent('aceitatempo:langchange', { detail: { lang: detectLang() } }));
  }

  const PREF_META = {
    auto: { key: 'langAuto', value: 'auto' },
    'pt-BR': { key: 'langPt', value: 'pt-BR' },
    en: { key: 'langEn', value: 'en' },
  };

  function syncDropdown(root) {
    const stored = getStoredPref();
    const meta = PREF_META[stored];
    const optionEl = root.querySelector('.lang-option[data-value="' + meta.value + '"]');
    const labelEl = optionEl?.querySelector('[data-i18n="' + meta.key + '"]');
    const currentLabel = labelEl?.textContent || meta.value;
    const btn = root.querySelector('.lang-trigger');
    if (btn) btn.textContent = currentLabel;
    root.querySelectorAll('.lang-option').forEach((opt) => {
      const selected = opt.dataset.value === stored;
      opt.setAttribute('aria-selected', selected ? 'true' : 'false');
      opt.classList.toggle('is-active', selected);
    });
  }

  function initSelector() {
    const root = document.getElementById('lang-select');
    if (!root) return;

    syncDropdown(root);

    const btn = root.querySelector('.lang-trigger');
    const menu = root.querySelector('.lang-menu');

    if (btn && menu) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = root.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      menu.addEventListener('click', (e) => {
        const opt = e.target.closest('.lang-option');
        if (!opt) return;
        setLang(opt.dataset.value);
        root.classList.remove('is-open');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });
      document.addEventListener('click', (e) => {
        if (!root.contains(e.target)) {
          root.classList.remove('is-open');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && root.classList.contains('is-open')) {
          root.classList.remove('is-open');
          if (btn) btn.setAttribute('aria-expanded', 'false');
          btn.focus();
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
    initSelector();
  });

  window.AceitaTempoDocsI18n = { detectLang, getStoredPref, setLang, t, applyTranslations };
})();