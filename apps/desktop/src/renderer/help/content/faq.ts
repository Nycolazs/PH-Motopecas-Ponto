import type { HelpArticle } from '../help-types.js';

export const FAQ_ARTICLES: HelpArticle[] = [
  {
    slug: 'perguntas-frequentes',
    title: 'Perguntas frequentes do administrador',
    summary: 'Respostas rápidas para as situações mais comuns do dia a dia.',
    category: 'duvidas',
    audience: ['admin'],
    keywords: ['dúvida', 'pergunta', 'faq', 'problema', 'como faço', 'ajuda'],
    sections: [
      {
        id: 'esqueceu-de-bater',
        title: 'Um colaborador esqueceu de bater o ponto. E agora?',
        paragraphs: [
          'Em Registros de Ponto, use Inserir Ponto Manual com o horário real e uma justificativa. Se ele bateu num horário errado, ele mesmo pode pedir o ajuste pelo aplicativo, ou você pode usar Corrigir.',
        ],
      },
      {
        id: 'bateu-duas-vezes',
        title: 'Alguém bateu o ponto duas vezes sem querer',
        paragraphs: [
          'Batidas com menos de 30 segundos de diferença já são recusadas. Se a segunda batida entrou, abra Registros de Ponto, clique em Corrigir nela e use Anular batida com o motivo.',
        ],
      },
      {
        id: 'hora-do-computador',
        title: 'O relógio do computador da loja está errado. Isso afeta o ponto?',
        paragraphs: [
          'Não. O horário de cada batida é sempre o do servidor da empresa, em horário de Fortaleza.',
        ],
      },
      {
        id: 'sem-internet',
        title: 'A internet caiu. Os colaboradores conseguem bater o ponto?',
        paragraphs: [
          'Não: o ponto só vale quando o servidor confirma. O aplicativo avisa que está sem conexão. Quando a internet voltar, quem não conseguiu bater pode pedir ajuste, ou você insere as batidas manualmente.',
        ],
      },
      {
        id: 'fechar-mes',
        title: 'Como fecho o mês?',
        bullets: [
          'Resolva as Solicitações de Ajuste pendentes.',
          'Corrija os Espelhos Incompletos do mês.',
          'Em Relatórios & Espelho, confira os saldos e use Imprimir espelhos para colher as assinaturas.',
        ],
      },
      {
        id: 'feriado',
        title: 'Vai ter feriado municipal ou a loja vai fechar mais cedo',
        paragraphs: [
          'Em Jornadas & Regras › Feriados e exceções, cadastre a data como Feriado, Fechado Administrativo ou Horário Especial. O cálculo daquele dia muda só para aquela data.',
        ],
      },
      {
        id: 'mudou-horario',
        title: 'O horário da loja mudou',
        paragraphs: [
          'Crie uma Nova jornada com a data de início da mudança. Os meses anteriores continuam calculados com o horário antigo.',
        ],
      },
      {
        id: 'saiu-da-empresa',
        title: 'Um colaborador saiu da empresa',
        paragraphs: [
          'Na ficha dele, use Desligar Colaborador e informe o motivo. O acesso é bloqueado, mas as batidas e os documentos continuam guardados para consulta e relatórios.',
        ],
      },
      {
        id: 'atualizar-app',
        title: 'Como sei se o aplicativo da loja está atualizado?',
        paragraphs: [
          'A tela de login do aplicativo mostra a versão instalada e se ela está atualizada. As atualizações são instaladas sozinhas quando o computador fica livre.',
        ],
      },
    ],
    related: ['registros-de-ponto', 'relatorios-e-espelho', 'aplicativo-desktop'],
  },
  {
    slug: 'duvidas-do-colaborador',
    title: 'Dúvidas frequentes do colaborador',
    summary: 'O que fazer quando o ponto não registra, quando esquecer de bater ou da senha.',
    category: 'duvidas',
    audience: ['employee', 'admin'],
    keywords: ['dúvida', 'pergunta', 'problema', 'não consigo', 'erro', 'faq'],
    sections: [
      {
        id: 'esqueci-de-bater',
        title: 'Esqueci de bater o ponto',
        paragraphs: [
          'Se você bateu num horário errado, clique no lápis ao lado da batida e peça o ajuste. Se não bateu nenhuma vez, avise o administrador para ele inserir a batida.',
        ],
      },
      {
        id: 'nao-registrou',
        title: 'Cliquei em Bater ponto e não registrou',
        paragraphs: [
          'Veja se aparece o aviso de sem conexão. O ponto só vale quando o servidor confirma. Se o problema continuar, avise o administrador.',
        ],
      },
      {
        id: 'senha',
        title: 'Esqueci minha senha',
        paragraphs: ['Peça ao administrador para redefinir a sua senha.'],
      },
      {
        id: 'saldo-negativo',
        title: 'Por que meu saldo está negativo?',
        paragraphs: [
          'O saldo é a diferença entre as horas trabalhadas e as esperadas. Atrasos, saídas mais cedo e dias com ponto incompleto deixam o saldo menor. Confira dia a dia no Histórico.',
        ],
      },
    ],
    related: ['bater-ponto', 'pedir-ajuste', 'meu-historico'],
  },
];
