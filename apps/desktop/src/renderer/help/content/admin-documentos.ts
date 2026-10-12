import type { HelpArticle } from '../help-types.js';

export const ADMIN_DOCUMENT_ARTICLES: HelpArticle[] = [
  {
    slug: 'documentos-e-rh',
    title: 'Documentos & RH: como funciona',
    summary:
      'Todos os documentos seguem o mesmo caminho: preencher, conferir a prévia e salvar ou imprimir. Os PDFs ficam guardados com criptografia.',
    category: 'documentos',
    audience: ['admin'],
    keywords: [
      'documento',
      'pdf',
      'prévia',
      'imprimir',
      'salvar',
      'gerar',
      'emitir',
      'criptografia',
      'arquivo',
      'últimos pdfs',
    ],
    screen: { label: 'Documentos & RH', path: '/admin/documentos/gerar' },
    sections: [
      {
        id: 'escolher',
        title: 'Escolher o documento',
        image: {
          key: 'documentos-hub',
          alt: 'Central Documentos & RH com os modelos agrupados',
        },
        paragraphs: [
          'Os modelos estão agrupados em Empresa e regras, Contratação e termos, Medidas disciplinares, Desempenho e Ponto e frequência. Use a busca no topo para achar um modelo pelo nome.',
        ],
      },
      {
        id: 'previa',
        title: 'Prévia, salvar e imprimir',
        steps: [
          {
            title: 'Preencha o formulário',
            text: 'Cada documento tem seu formulário. Campos com * são obrigatórios. Use Salvar Rascunho para continuar depois.',
          },
          {
            title: 'Clique em Visualizar',
            text: 'O PDF é montado e aparece numa prévia, com zoom. Nada é guardado ainda.',
            image: {
              key: 'documento-previa',
              alt: 'Prévia do documento com os botões Voltar e Editar, salvar e Imprimir e Salvar',
            },
          },
          {
            title: 'Decida o que fazer',
            text: 'Voltar e Editar fecha a prévia para corrigir algo. O botão do meio (por exemplo Emitir Medida ou Publicar Documento) salva sem imprimir. Imprimir e Salvar guarda o PDF e abre a janela de impressão.',
          },
        ],
        tip: 'Prévias que não foram salvas são apagadas automaticamente depois de 24 horas.',
      },
      {
        id: 'criptografia',
        title: 'Onde os PDFs ficam guardados',
        paragraphs: [
          'Os PDFs salvos ficam no servidor com criptografia, organizados por ano e mês. Sem a chave da empresa, os arquivos não podem ser abertos, e o sistema confere a integridade de cada arquivo sempre que ele é aberto.',
        ],
      },
      {
        id: 'ultimos',
        title: 'Últimos PDFs gerados',
        paragraphs: [
          'No topo de Documentos & RH aparecem os últimos documentos salvos. Clique em um cartão para abrir o PDF, imprimir ou baixar.',
        ],
      },
    ],
    related: ['documentos-emitidos', 'regimento-interno', 'medidas-disciplinares'],
  },
  {
    slug: 'documentos-emitidos',
    title: 'Documentos emitidos (arquivo)',
    summary: 'Encontre, visualize, baixe, imprima ou anule qualquer documento já emitido.',
    category: 'documentos',
    audience: ['admin'],
    keywords: [
      'arquivo',
      'emitidos',
      'anular',
      'cancelar documento',
      'baixar pdf',
      'buscar documento',
    ],
    screen: { label: 'Documentos emitidos', path: '/admin/documentos' },
    sections: [
      {
        id: 'buscar',
        title: 'Encontrar um documento',
        image: { key: 'documentos-emitidos', alt: 'Lista de documentos emitidos com filtros' },
        paragraphs: [
          'Filtre por tipo de documento, por colaborador e pela situação (Válidos ou Anulados), ou busque pelo título. Clique em Ver para abrir o PDF com as opções Baixar e Imprimir.',
        ],
      },
      {
        id: 'anular',
        title: 'Anular um documento',
        paragraphs: [
          'Se um documento foi emitido por engano, use Anular e escreva o motivo. Ele continua no arquivo, marcado como Anulado, e o motivo fica registrado. Documentos não são apagados.',
        ],
      },
    ],
    related: ['documentos-e-rh'],
  },
  {
    slug: 'regimento-interno',
    title: 'Regimento Interno',
    summary:
      'Monte as regras da empresa em 6 etapas. A versão publicada define também a tolerância de atraso.',
    category: 'documentos',
    audience: ['admin'],
    keywords: ['regimento', 'regras', 'normas', 'tolerância', 'conduta', 'uniforme', 'celular'],
    screen: { label: 'Regimento Interno', path: '/admin/documentos/regimento' },
    sections: [
      {
        id: 'etapas',
        title: 'As 6 etapas',
        image: { key: 'regimento', alt: 'Assistente do Regimento Interno na etapa 1' },
        bullets: [
          '1. Empresa: identificação e princípios que norteiam o trabalho.',
          '2. Jornada: carga semanal, almoço, tolerância de atraso, horas extras e regras de ponto.',
          '3. Conduta: vestimenta, atendimento ao cliente e o que é proibido.',
          '4. Tecnologia: uso de internet, celular e equipamentos.',
          '5. Disciplina: como funcionam as advertências e a suspensão.',
          '6. Revisão: confira tudo antes de gerar o PDF.',
        ],
        paragraphs: [
          'Os campos já vêm com um texto sugerido. Ajuste ao jeito da loja e use Adicionar para incluir itens nas listas. Anterior e Próxima Etapa navegam entre as etapas, e Salvar Rascunho guarda o que já foi feito.',
        ],
      },
      {
        id: 'tolerancia',
        title: 'Tolerância de atraso',
        image: { key: 'regimento-jornada', alt: 'Etapa Jornada do Regimento com a tolerância' },
        paragraphs: [
          'Na etapa 2, a tolerância (de 0 a 30 minutos) diz quanto atraso é aceito na entrada. Ela é usada pelos alertas no WhatsApp a partir do dia em que a versão é publicada.',
        ],
      },
      {
        id: 'publicar',
        title: 'Publicar e coletar a ciência',
        paragraphs: [
          'Na revisão, visualize o PDF e confirme a publicação. Cada publicação cria uma nova versão; as anteriores ficam em Histórico. Depois, emita o Termo de Ciência do Regimento para cada colaborador assinar.',
        ],
      },
    ],
    related: ['termos-de-ciencia', 'alertas-no-whatsapp', 'documentos-e-rh'],
  },
  {
    slug: 'manual-de-cultura',
    title: 'Manual de Cultura',
    summary:
      'Missão, visão e valores da empresa em um documento para fixar e compartilhar com a equipe.',
    category: 'documentos',
    audience: ['admin'],
    keywords: ['cultura', 'missão', 'visão', 'valores', 'princípios', 'lema'],
    screen: { label: 'Manual de Cultura', path: '/admin/documentos/cultura' },
    sections: [
      {
        id: 'preencher',
        title: 'Preencher',
        image: { key: 'cultura', alt: 'Formulário do Manual de Cultura' },
        steps: [
          {
            title: 'Missão e visão',
            text: 'Escreva em poucas linhas a razão de ser da loja e onde ela quer chegar.',
          },
          {
            title: 'Valores',
            text: 'Use Adicionar Valor para incluir até 10 valores, cada um com uma frase explicando o comportamento esperado.',
          },
          {
            title: 'Visualizar e publicar',
            text: 'Clique em Visualizar Prévia em PDF, confira e use Publicar Documento ou Imprimir e Salvar.',
          },
        ],
      },
    ],
    related: ['documentos-e-rh', 'regimento-interno'],
  },
  {
    slug: 'guia-de-entrevista',
    title: 'Guia de Entrevista',
    summary: 'Avalie candidatos com uma matriz de critérios de 1 a 5 e registre o parecer final.',
    category: 'documentos',
    audience: ['admin'],
    keywords: ['entrevista', 'candidato', 'seleção', 'contratação', 'vaga', 'recrutamento'],
    screen: { label: 'Guia de Entrevista', path: '/admin/documentos/entrevista' },
    sections: [
      {
        id: 'preencher',
        title: 'Conduzir a entrevista',
        image: { key: 'entrevista', alt: 'Formulário do Guia de Entrevista' },
        steps: [
          {
            title: 'Dados do candidato e da vaga',
            text: 'Informe o nome do candidato, o cargo pretendido, a data e o entrevistador.',
          },
          {
            title: 'Dê notas de 1 a 5',
            text: 'Para cada critério da matriz, clique na nota. Use as observações para anotar o que o candidato disse.',
          },
          {
            title: 'Parecer final',
            text: 'Escreva a síntese e a recomendação. Clique em Visualizar PDF e arquive.',
          },
        ],
        tip: 'As entrevistas já realizadas ficam listadas no fim da página.',
      },
    ],
    related: ['documentos-e-rh', 'colaboradores'],
  },
  {
    slug: 'termos-de-ciencia',
    title: 'Termos de ciência (Regimento e Cargo)',
    summary:
      'O colaborador declara que recebeu e conhece o Regimento Interno ou a descrição do seu cargo.',
    category: 'documentos',
    audience: ['admin'],
    keywords: ['termo', 'ciência', 'assinatura', 'recebimento', 'declaração', 'cargo', 'regimento'],
    screen: { label: 'Termo de Ciência', path: '/admin/documentos/ciencia' },
    sections: [
      {
        id: 'emitir',
        title: 'Emitir um termo',
        image: { key: 'ciencia', alt: 'Tela de emissão do Termo de Ciência' },
        steps: [
          {
            title: 'Escolha o colaborador',
            text: 'Em Colaborador Ativo, selecione a pessoa. O CPF é preenchido a partir da ficha.',
          },
          {
            title: 'Visualize o termo',
            text: 'Clique em Visualizar Termo de Ciência (PDF). O termo traz a versão em vigor do Regimento ou do cargo.',
          },
          {
            title: 'Imprima e colha a assinatura',
            text: 'Use Imprimir e Salvar e peça para o colaborador assinar a via impressa.',
          },
        ],
        tip: 'Na ficha do colaborador, os atalhos Ciência do Regimento e Ciência de Função já abrem esta tela com a pessoa escolhida.',
      },
    ],
    related: ['regimento-interno', 'cargos-e-funcoes', 'inicio-e-metas'],
  },
  {
    slug: 'medidas-disciplinares',
    title: 'Advertências e suspensão',
    summary:
      'Registre advertência verbal, advertência escrita ou suspensão, com os fatos, testemunhas e o histórico do colaborador.',
    category: 'documentos',
    audience: ['admin'],
    keywords: [
      'advertência',
      'suspensão',
      'disciplina',
      'punição',
      'ocorrência',
      'testemunha',
      'verbal',
      'escrita',
    ],
    screen: { label: 'Medidas disciplinares', path: '/admin/documentos/disciplina' },
    sections: [
      {
        id: 'emitir',
        title: 'Registrar uma medida',
        image: { key: 'disciplina', alt: 'Formulário de medida disciplinar' },
        steps: [
          {
            title: 'Escolha a medida',
            text: 'Advertência verbal para faltas leves, advertência escrita na reincidência e suspensão (até 30 dias) para faltas graves.',
          },
          {
            title: 'Escolha o colaborador',
            text: 'Se for reincidência, indique em Medida Anterior de Referência a advertência que veio antes.',
          },
          {
            title: 'Descreva os fatos',
            text: 'Data, local, motivo e o relato detalhado com as orientações dadas. Se quiser, cite a cláusula do Regimento.',
          },
          {
            title: 'Testemunhas (opcional)',
            text: 'Informe quem presenciou a notificação, principalmente se o colaborador se recusar a assinar.',
          },
          {
            title: 'Visualize e emita',
            text: 'Clique em Visualizar Documento (PDF), confira e use Emitir Medida ou Imprimir e Salvar.',
          },
        ],
      },
      {
        id: 'prontuario',
        title: 'Prontuário e anulação',
        paragraphs: [
          'Ao escolher o colaborador, o Prontuário Disciplinar mostra as medidas anteriores dele. O Histórico Geral lista as medidas de toda a equipe, com Ver PDF e Anular (com motivo) para medidas emitidas por engano.',
        ],
      },
    ],
    related: ['regimento-interno', 'ficha-do-colaborador', 'documentos-emitidos'],
  },
  {
    slug: 'avaliacao-de-desempenho',
    title: 'Avaliação de desempenho',
    summary:
      'Avalie o colaborador em 8 critérios de 1 a 5, registre pontos fortes e um plano de desenvolvimento.',
    category: 'documentos',
    audience: ['admin'],
    keywords: ['avaliação', 'desempenho', 'feedback', 'nota', 'critério', 'plano de ação'],
    screen: { label: 'Avaliação de Desempenho', path: '/admin/documentos/avaliacao' },
    sections: [
      {
        id: 'avaliar',
        title: 'Fazer uma avaliação',
        image: { key: 'avaliacao', alt: 'Formulário de avaliação de desempenho' },
        steps: [
          {
            title: 'Identifique a avaliação',
            text: 'Escolha o colaborador, o período avaliado (por exemplo 1º Semestre / 2026), a data e o avaliador.',
          },
          {
            title: 'Dê as notas',
            text: 'Pontualidade, produtividade, conhecimento técnico, trabalho em equipe, conduta, proatividade, organização e segurança: nota de 1 a 5 em cada. A média e a classificação aparecem em Resultado.',
          },
          {
            title: 'Escreva o diagnóstico',
            text: 'Pontos fortes, oportunidades de melhoria, plano de ação e, se houver, a reação do colaborador.',
          },
          {
            title: 'Visualize e conclua',
            text: 'Clique em Visualizar Documento PDF e use Concluir Avaliação ou Imprimir e Salvar.',
          },
        ],
        tip: 'Para corrigir uma avaliação já concluída, faça uma nova e escolha a anterior em Substituir Avaliação Anterior?.',
      },
    ],
    related: ['ficha-do-colaborador', 'documentos-e-rh'],
  },
];
