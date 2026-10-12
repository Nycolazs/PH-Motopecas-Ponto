import type { HelpArticle } from '../help-types.js';

export const ADMIN_START_ARTICLES: HelpArticle[] = [
  {
    slug: 'primeiros-passos',
    title: 'Primeiros passos no PH-Ponto',
    summary:
      'O roteiro para deixar o sistema pronto: dados da empresa, jornada, colaboradores, aplicativo e alertas.',
    category: 'comecar',
    audience: ['admin'],
    keywords: [
      'começar',
      'configurar',
      'implantação',
      'tutorial',
      'iniciar',
      'roteiro',
      'checklist',
      'novo',
    ],
    sections: [
      {
        id: 'visao-geral',
        title: 'Como o sistema funciona',
        paragraphs: [
          'O PH-Ponto tem duas partes. O painel do administrador (este site) é onde você cadastra a equipe, acompanha a frequência, corrige pontos, emite documentos e fecha o mês.',
          'Os colaboradores batem o ponto pelo aplicativo PH-Ponto instalado no computador da loja. O horário de cada batida é sempre o do servidor, e não o do computador, então ninguém consegue adiantar ou atrasar o relógio.',
        ],
      },
      {
        id: 'roteiro',
        title: 'Roteiro de implantação',
        steps: [
          {
            title: 'Preencha os dados da empresa',
            text: 'Em Empresa & Sistema › Minha Empresa, informe razão social, nome fantasia, CNPJ e endereço. Esses dados aparecem no cabeçalho de todos os documentos e espelhos de ponto.',
          },
          {
            title: 'Confira a jornada de trabalho',
            text: 'Em Empresa & Sistema › Jornadas & Regras, defina os horários de cada dia da semana e cadastre os feriados. É a partir da jornada que o sistema calcula horas esperadas, saldo e horas extras.',
          },
          {
            title: 'Cadastre os cargos',
            text: 'Em Cargos & Funções, descreva as funções da loja. Os cargos são usados nos termos de ciência e na ficha de cada colaborador.',
          },
          {
            title: 'Cadastre os colaboradores',
            text: 'Em Ponto & Frequência › Colaboradores, clique em Novo Funcionário e crie o login e a senha inicial de cada pessoa.',
          },
          {
            title: 'Instale o aplicativo na loja',
            text: 'Em Aplicativo Desktop, baixe o instalador do Windows e instale no computador onde a equipe vai bater o ponto. O aplicativo se atualiza sozinho depois disso.',
          },
          {
            title: 'Publique o Regimento Interno',
            text: 'Em Documentos & RH › Regimento Interno, monte as regras da empresa. A tolerância de atraso definida ali também é usada pelos alertas no WhatsApp.',
          },
          {
            title: 'Ative os alertas no WhatsApp (opcional)',
            text: 'Em Alertas no WhatsApp, conecte o número da loja e escolha quais administradores recebem aviso quando alguém chega atrasado.',
          },
        ],
        tip: 'Pressione F1 em qualquer tela para abrir a ajuda daquela tela.',
      },
      {
        id: 'rotina',
        title: 'Rotina sugerida',
        bullets: [
          'Todo dia: olhe o Painel Operacional para ver quem já chegou e quem está em almoço.',
          'Toda semana: responda as Solicitações de Ajuste e corrija os Espelhos Incompletos.',
          'Todo mês: abra Relatórios & Espelho, confira os saldos e imprima os espelhos para assinatura.',
        ],
      },
    ],
    related: ['acessar-o-sistema', 'colaboradores', 'jornadas-e-calendario', 'aplicativo-desktop'],
  },
  {
    slug: 'acessar-o-sistema',
    title: 'Entrar e sair do sistema',
    summary: 'Como fazer login no painel, sair com segurança e o que fazer se esquecer a senha.',
    category: 'comecar',
    audience: ['admin'],
    keywords: ['login', 'senha', 'entrar', 'acesso', 'sair', 'logout', 'esqueci', 'tema escuro'],
    sections: [
      {
        id: 'entrar',
        title: 'Entrar no painel',
        steps: [
          {
            title: 'Abra o endereço do sistema',
            text: 'No navegador, acesse phmotopecas.com. A tela de login do administrador aparece.',
            image: { key: 'login-admin', alt: 'Tela de login do painel do administrador' },
          },
          {
            title: 'Informe login e senha',
            text: 'Digite o seu login de administrador e a senha. Use o ícone de olho para conferir o que digitou.',
          },
          {
            title: 'Clique em Entrar',
            text: 'Você é levado para Início & Metas.',
          },
        ],
        warning:
          'Não existe bloqueio por tentativas erradas. Por isso, use uma senha forte e não a compartilhe.',
      },
      {
        id: 'esqueci-senha',
        title: 'Esqueci minha senha',
        paragraphs: [
          'Peça a outro administrador para abrir Empresa & Sistema › Administradores e usar Redefinir senha na sua conta. Depois de entrar, troque a senha por uma só sua.',
        ],
      },
      {
        id: 'sair',
        title: 'Sair do sistema',
        paragraphs: [
          'No canto inferior esquerdo, ao lado do seu nome, clique no ícone de saída. Sempre saia ao usar um computador compartilhado.',
        ],
      },
      {
        id: 'tema',
        title: 'Tema claro ou escuro',
        paragraphs: [
          'O botão com a lua (ou o sol) no canto superior direito alterna entre o tema claro e o escuro. A escolha fica salva neste computador.',
        ],
      },
    ],
    related: ['administradores', 'primeiros-passos'],
  },
  {
    slug: 'inicio-e-metas',
    title: 'Início & Metas',
    summary:
      'A tela inicial do administrador: indicadores da equipe, metas de gestão e atalhos para o que precisa de atenção.',
    category: 'comecar',
    audience: ['admin'],
    keywords: ['dashboard', 'painel', 'indicadores', 'metas', 'resumo', 'home', 'conformidade'],
    screen: { label: 'Início & Metas', path: '/admin' },
    sections: [
      {
        id: 'indicadores',
        title: 'Indicadores do topo',
        image: {
          key: 'inicio-metas',
          alt: 'Tela Início & Metas com os quatro indicadores',
          caption: 'Os quatro cartões resumem a situação da equipe neste momento.',
        },
        bullets: [
          'Quadro de equipe: quantos colaboradores ativos existem e quantos cargos estão cadastrados.',
          'Presença hoje: quantos já registraram entrada. Clique em Ao vivo para ver o Painel Operacional.',
          'Saúde operacional: pendências a resolver, como solicitações de ajuste e dias com batidas ímpares. Clique em Revisar.',
          'Conformidade CLT: quantos colaboradores já assinaram o termo de ciência do Regimento Interno.',
        ],
      },
      {
        id: 'metas',
        title: 'Metas e indicadores de gestão',
        paragraphs: [
          'Logo abaixo ficam as metas da loja: pontualidade, regularidade dos registros, cobertura documental e avaliações de desempenho. Cada meta mostra o resultado atual e um atalho para agir.',
        ],
      },
      {
        id: 'atalhos',
        title: 'Ações rápidas',
        paragraphs: [
          'No fim da página há atalhos para o Painel Operacional, para gerar documentos, para os ajustes de ponto e para os relatórios, além dos últimos registros da equipe.',
        ],
      },
    ],
    related: ['painel-operacional', 'solicitacoes-de-ajuste', 'termos-de-ciencia'],
  },
];

export const ADMIN_PUNCH_ARTICLES: HelpArticle[] = [
  {
    slug: 'painel-operacional',
    title: 'Painel Operacional (frequência ao vivo)',
    summary: 'Veja em tempo real quem está trabalhando, em almoço ou ainda não chegou.',
    category: 'ponto',
    audience: ['admin'],
    keywords: ['ao vivo', 'presença', 'quem chegou', 'frequência', 'hoje', 'almoço', 'jornada'],
    screen: { label: 'Painel Operacional', path: '/admin/gestao' },
    sections: [
      {
        id: 'quadro',
        title: 'Quadro de frequência do dia',
        image: {
          key: 'painel-operacional',
          alt: 'Painel Operacional com o quadro de frequência do dia',
        },
        paragraphs: [
          'Cada linha mostra um colaborador com o status atual, as horas trabalhadas, o saldo do dia e a última batida. Os filtros no topo separam quem está em jornada, em almoço ou ainda não iniciou.',
          'Use Ver espelho para abrir o dia daquele colaborador e conferir as batidas.',
        ],
      },
      {
        id: 'acoes',
        title: 'Ações da tela',
        bullets: [
          'Avaliar Solicitações: abre os pedidos de ajuste enviados pelos colaboradores.',
          'Inserir Ponto: registra uma batida esquecida (veja Registros de Ponto).',
          'Batidas recentes e correções recentes: o que aconteceu por último na loja.',
        ],
      },
    ],
    related: ['registros-de-ponto', 'solicitacoes-de-ajuste'],
  },
  {
    slug: 'registros-de-ponto',
    title: 'Registros de Ponto: conferir, inserir e corrigir',
    summary:
      'Confira as batidas de qualquer dia, insira um ponto esquecido ou corrija um horário, sempre com justificativa e histórico.',
    category: 'ponto',
    audience: ['admin'],
    keywords: [
      'batida',
      'inserir ponto',
      'ponto manual',
      'esqueceu de bater',
      'corrigir horário',
      'anular batida',
      'excluir ponto',
      'apagar ponto',
      'editar ponto',
    ],
    screen: { label: 'Registros de Ponto', path: '/admin/pontos' },
    sections: [
      {
        id: 'conferir',
        title: 'Conferir as batidas de um dia',
        steps: [
          {
            title: 'Escolha a data',
            text: 'No campo Data, selecione o dia. O quadro mostra todos os colaboradores com o previsto, o trabalhado, o saldo e a última batida.',
            image: { key: 'registros-ponto', alt: 'Tela Registros de Ponto com o quadro do dia' },
          },
          {
            title: 'Filtre por colaborador (opcional)',
            text: 'Em Filtrar por Colaborador, escolha uma pessoa para ver só as batidas dela.',
          },
          {
            title: 'Abra as batidas',
            text: 'Clique em Ver Batidas para listar as entradas e saídas daquele dia, com o botão Corrigir em cada uma.',
          },
        ],
      },
      {
        id: 'inserir-manual',
        title: 'Inserir um ponto esquecido',
        steps: [
          {
            title: 'Clique em Inserir Ponto Manual',
            text: 'O botão fica no topo da tela.',
          },
          {
            title: 'Preencha colaborador, data e horário',
            text: 'Não é preciso dizer se é entrada ou saída: o sistema calcula pela ordem das batidas do dia.',
            image: { key: 'ponto-manual', alt: 'Janela Inserir Ponto Manual' },
          },
          {
            title: 'Escreva a justificativa',
            text: 'A justificativa é obrigatória e fica gravada no histórico, por exemplo: "Funcionário esqueceu de registrar a volta do almoço".',
          },
          {
            title: 'Confirme',
            text: 'Clique em Inserir Ponto. Se o dia já estiver completo, o sistema pede uma confirmação extra antes de adicionar mais uma batida.',
          },
        ],
      },
      {
        id: 'corrigir',
        title: 'Corrigir o horário de uma batida',
        steps: [
          {
            title: 'Clique em Corrigir na batida',
            text: 'A janela mostra o horário original e o histórico de ajustes daquela batida.',
            image: { key: 'correcao-ponto', alt: 'Janela Corrigir Horário de Ponto' },
          },
          {
            title: 'Informe o novo horário e o motivo',
            text: 'Escolha um motivo da lista (esquecimento, horário incorreto, atestado, serviço externo…) e confirme.',
          },
        ],
        tip: 'A batida original nunca é apagada. Relatórios e espelhos usam o horário corrigido, e o histórico mostra quem corrigiu, quando e por quê.',
      },
      {
        id: 'anular',
        title: 'Anular uma batida registrada por engano',
        paragraphs: [
          'Na janela de correção, use Anular batida e informe o motivo. A batida deixa de contar nos cálculos, mas continua no histórico e na Trilha de Auditoria.',
        ],
      },
    ],
    related: ['solicitacoes-de-ajuste', 'espelhos-incompletos', 'calculo-de-horas'],
  },
  {
    slug: 'solicitacoes-de-ajuste',
    title: 'Aprovar ou recusar solicitações de ajuste',
    summary:
      'Quando um colaborador pede para corrigir uma batida pelo aplicativo, o pedido chega aqui para você decidir.',
    category: 'ponto',
    audience: ['admin'],
    keywords: ['pedido', 'ajuste', 'aprovar', 'recusar', 'correção', 'solicitação', 'pendente'],
    screen: { label: 'Solicitações de Ajuste', path: '/admin/solicitacoes' },
    sections: [
      {
        id: 'avaliar',
        title: 'Avaliar um pedido',
        steps: [
          {
            title: 'Abra Solicitações de Ajuste',
            text: 'O número ao lado do menu Ponto & Frequência mostra quantos pedidos e dias incompletos estão pendentes.',
            image: { key: 'solicitacoes', alt: 'Lista de solicitações de ajuste pendentes' },
          },
          {
            title: 'Compare os horários',
            text: 'Cada pedido mostra o horário atual, o horário solicitado e o motivo escrito pelo colaborador.',
          },
          {
            title: 'Aprove ou recuse',
            text: 'Em Aprovar Ajuste, o ponto é corrigido e as horas são recalculadas na hora. Em Recusar, o ponto original continua valendo. Nos dois casos você pode deixar um parecer.',
            image: { key: 'solicitacao-aprovar', alt: 'Confirmação de aprovação do ajuste' },
          },
        ],
        tip: 'O colaborador acompanha a resposta em Minhas Solicitações, no aplicativo.',
      },
      {
        id: 'filtros',
        title: 'Consultar pedidos antigos',
        paragraphs: [
          'Use as abas Pendentes, Aprovadas, Recusadas e Todas para consultar o histórico de pedidos.',
        ],
      },
    ],
    related: ['registros-de-ponto', 'pedir-ajuste'],
  },
  {
    slug: 'espelhos-incompletos',
    title: 'Espelhos incompletos (batidas ímpares)',
    summary:
      'Dias em que falta uma entrada ou uma saída. Corrija-os antes de fechar o mês para o saldo ficar certo.',
    category: 'ponto',
    audience: ['admin'],
    keywords: [
      'incompleto',
      'ímpar',
      'faltou batida',
      'esqueceu saída',
      'pendência',
      'falta batida',
    ],
    screen: { label: 'Espelhos Incompletos', path: '/admin/incompletos' },
    sections: [
      {
        id: 'o-que-e',
        title: 'O que é um dia incompleto',
        paragraphs: [
          'Um dia é incompleto quando o número de batidas é ímpar, por exemplo quando o colaborador entrou mas não registrou a saída. Enquanto não for corrigido, as horas daquele dia não fecham.',
        ],
        image: { key: 'incompletos', alt: 'Tela Batidas Incompletas com um dia pendente' },
      },
      {
        id: 'corrigir',
        title: 'Corrigir',
        steps: [
          {
            title: 'Escolha o mês',
            text: 'A lista mostra cada dia incompleto com as batidas que já existem e onde falta a batida.',
          },
          {
            title: 'Clique em Corrigir Ponto',
            text: 'Você vai direto para a ficha do colaborador naquele dia. Insira a batida que faltou com uma justificativa.',
          },
        ],
        tip: 'Se o colaborador ainda estiver trabalhando hoje, o dia de hoje não aparece aqui: ele só é considerado incompleto depois que o dia termina.',
      },
    ],
    related: ['registros-de-ponto', 'relatorios-e-espelho'],
  },
  {
    slug: 'calculo-de-horas',
    title: 'Como as horas são calculadas',
    summary:
      'Entenda horas esperadas, trabalhadas, saldo, horas extras, folgas, feriados e férias.',
    category: 'ponto',
    audience: ['admin', 'employee'],
    keywords: [
      'saldo',
      'banco de horas',
      'hora extra',
      'atraso',
      'falta',
      'esperado',
      'trabalhado',
      'tolerância',
      'cálculo',
    ],
    sections: [
      {
        id: 'conceitos',
        title: 'Conceitos',
        bullets: [
          'Esperado: as horas que a jornada da empresa prevê para o dia, já descontado o almoço.',
          'Trabalhado: a soma dos intervalos entre cada entrada e a saída seguinte.',
          'Saldo do dia: trabalhado menos esperado. Positivo é hora extra; negativo são horas faltantes.',
          'Saldo do mês: a soma dos saldos dos dias já encerrados. O dia de hoje só entra depois que termina, e dias incompletos ficam de fora até serem corrigidos.',
        ],
      },
      {
        id: 'batidas',
        title: 'Entradas e saídas',
        paragraphs: [
          'As batidas se alternam automaticamente: a primeira do dia é entrada, a segunda é saída, a terceira é entrada de novo, e assim por diante. Um dia normal tem quatro batidas: entrada, saída para o almoço, volta do almoço e saída.',
          'Duas batidas com menos de 30 segundos de diferença são recusadas, para evitar registro em dobro por clique repetido.',
        ],
      },
      {
        id: 'dias-especiais',
        title: 'Folgas, feriados e férias',
        paragraphs: [
          'Em folgas, feriados e férias o esperado é zero. Se alguém trabalhar nesses dias, todo o tempo conta como saldo positivo.',
          'Os dias anteriores ao cadastro do colaborador não contam.',
        ],
      },
      {
        id: 'tolerancia',
        title: 'Tolerância de atraso',
        paragraphs: [
          'O saldo é calculado minuto a minuto. A tolerância definida no Regimento Interno (5 minutos, se ainda não houver Regimento publicado) é usada para decidir quando enviar o alerta de atraso no WhatsApp.',
        ],
      },
    ],
    related: ['jornadas-e-calendario', 'relatorios-e-espelho', 'alertas-no-whatsapp'],
  },
];
