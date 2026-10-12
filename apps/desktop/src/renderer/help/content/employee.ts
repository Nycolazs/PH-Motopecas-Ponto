import type { HelpArticle } from '../help-types.js';

export const EMPLOYEE_ARTICLES: HelpArticle[] = [
  {
    slug: 'bater-ponto',
    title: 'Como bater o ponto',
    summary:
      'Entre no aplicativo com seu login, clique em Bater ponto e confira o registro na linha do tempo.',
    category: 'colaborador',
    audience: ['employee', 'admin'],
    keywords: [
      'bater ponto',
      'registrar',
      'entrada',
      'saída',
      'almoço',
      'marcar ponto',
      'login',
      'entrar',
    ],
    screen: { label: 'Início', path: '/' },
    sections: [
      {
        id: 'entrar',
        title: 'Entrar no aplicativo',
        steps: [
          {
            title: 'Abra o PH-Ponto',
            text: 'No computador da loja, abra o PH-Ponto pelo atalho da área de trabalho ou pelo ícone perto do relógio do Windows.',
            image: { key: 'app-login', alt: 'Tela de login do aplicativo PH-Ponto' },
          },
          {
            title: 'Digite seu login e senha',
            text: 'Use o login e a senha que o administrador criou para você e clique em Entrar.',
          },
        ],
      },
      {
        id: 'registrar',
        title: 'Registrar o ponto',
        steps: [
          {
            title: 'Clique em Bater ponto',
            text: 'O botão azul grande registra a batida. O horário é o do servidor da empresa, não o do computador.',
            image: { key: 'app-inicio', alt: 'Tela inicial do aplicativo com o botão Bater ponto' },
          },
          {
            title: 'Confira a confirmação',
            text: 'Aparece "Ponto registrado com sucesso" com o horário. A batida entra em Registros de hoje.',
            image: { key: 'app-ponto-confirmado', alt: 'Confirmação de ponto registrado' },
          },
          {
            title: 'Pode sair',
            text: 'Depois de bater o ponto, se ninguém mexer no computador por 10 segundos, a sua sessão é encerrada sozinha, para o próximo colega usar.',
          },
        ],
        tip: 'Não precisa escolher entrada ou saída: o sistema alterna sozinho. A primeira batida do dia é a entrada, a segunda é a saída para o almoço, a terceira é a volta e a quarta é a saída.',
      },
      {
        id: 'resumo',
        title: 'O resumo do dia',
        paragraphs: [
          'Abaixo do botão aparecem as horas trabalhadas hoje, as esperadas, o saldo do dia e o saldo do mês. O status mostra se você ainda não iniciou, está trabalhando, em almoço ou fora do expediente.',
        ],
      },
      {
        id: 'problemas',
        title: 'Se o ponto não for registrado',
        bullets: [
          '"Sem conexão": o computador está sem internet. O ponto só conta quando o servidor confirma; tente de novo quando a conexão voltar.',
          '"Aguarde alguns instantes antes de bater o ponto novamente": você clicou duas vezes seguidas. A primeira batida já valeu.',
          'Se esqueceu de bater, peça um ajuste (veja Pedir ajuste de um ponto).',
        ],
      },
    ],
    related: ['pedir-ajuste', 'meu-historico', 'calculo-de-horas'],
  },
  {
    slug: 'pedir-ajuste',
    title: 'Pedir ajuste de um ponto',
    summary:
      'Bateu no horário errado? Peça a correção pelo aplicativo e acompanhe a resposta do administrador.',
    category: 'colaborador',
    audience: ['employee', 'admin'],
    keywords: [
      'ajuste',
      'corrigir',
      'errei',
      'horário errado',
      'esqueci',
      'solicitação',
      'pedido',
      'minhas solicitações',
    ],
    screen: { label: 'Início', path: '/' },
    sections: [
      {
        id: 'pedir',
        title: 'Fazer o pedido',
        steps: [
          {
            title: 'Clique no lápis ao lado da batida',
            text: 'Em Registros de hoje, ou no Histórico para dias anteriores, clique no ícone de lápis da batida errada.',
          },
          {
            title: 'Informe o horário certo e o motivo',
            text: 'Escreva o horário correto e explique o que aconteceu, por exemplo: "Esqueci de bater na volta do almoço, voltei às 13:00".',
            image: { key: 'app-ajuste', alt: 'Janela Solicitar Ajuste de Ponto' },
          },
          {
            title: 'Clique em Enviar Solicitação',
            text: 'O pedido vai para o administrador avaliar.',
          },
        ],
      },
      {
        id: 'acompanhar',
        title: 'Acompanhar a resposta',
        image: { key: 'app-solicitacoes', alt: 'Janela Minhas Solicitações de Ajuste' },
        paragraphs: [
          'Clique em Minhas Solicitações para ver cada pedido como Pendente, Aprovado ou Recusado, com o horário anterior e o solicitado. Quando o pedido é aprovado, o horário já aparece corrigido.',
        ],
      },
      {
        id: 'esqueci',
        title: 'Esqueci de bater um ponto',
        paragraphs: [
          'O pedido de ajuste corrige uma batida que existe. Se você não bateu nenhuma vez, avise o administrador: ele pode inserir a batida que faltou.',
        ],
      },
    ],
    related: ['bater-ponto', 'meu-historico', 'solicitacoes-de-ajuste'],
  },
  {
    slug: 'meu-historico',
    title: 'Meu histórico e saldo de horas',
    summary: 'Consulte suas batidas, horas trabalhadas e saldo por semana, mês ou período.',
    category: 'colaborador',
    audience: ['employee', 'admin'],
    keywords: ['histórico', 'saldo', 'banco de horas', 'horas', 'mês', 'semana', 'consultar'],
    screen: { label: 'Histórico', path: '/historico' },
    sections: [
      {
        id: 'consultar',
        title: 'Consultar',
        image: { key: 'app-historico', alt: 'Tela Histórico de pontos do colaborador' },
        steps: [
          {
            title: 'Abra Histórico',
            text: 'No topo do aplicativo, clique em Histórico.',
          },
          {
            title: 'Escolha o período',
            text: 'Use Hoje, Esta semana, Este mês, Mês anterior ou Período personalizado.',
          },
          {
            title: 'Leia os totais',
            text: 'Os totais mostram o trabalhado, o esperado, o saldo e os dias incompletos. A tabela traz cada dia com as batidas e o status.',
          },
        ],
      },
      {
        id: 'status',
        title: 'O que significa cada status',
        bullets: [
          'Normal: trabalhou exatamente o esperado.',
          'Hora extra: trabalhou mais que o esperado.',
          'Horas faltantes: trabalhou menos que o esperado.',
          'Ponto incompleto: falta uma batida (por exemplo, a saída). Peça um ajuste.',
          'Folga, Feriado, Férias, Fechado ou Horário especial: dias com jornada diferente da normal.',
        ],
      },
    ],
    related: ['calculo-de-horas', 'pedir-ajuste'],
  },
  {
    slug: 'trocar-minha-senha',
    title: 'Trocar minha senha',
    summary: 'Troque a senha de acesso ao aplicativo quando quiser.',
    category: 'colaborador',
    audience: ['employee', 'admin'],
    keywords: ['senha', 'trocar senha', 'alterar senha', 'esqueci a senha', 'chave'],
    sections: [
      {
        id: 'trocar',
        title: 'Trocar',
        steps: [
          {
            title: 'Clique no ícone de chave',
            text: 'Fica no canto superior direito do aplicativo.',
          },
          {
            title: 'Preencha os três campos',
            text: 'Senha atual, nova senha e a confirmação da nova senha. A nova senha precisa ser diferente da atual.',
            image: { key: 'app-senha', alt: 'Janela Alterar Minha Senha' },
          },
          { title: 'Clique em Salvar Nova Senha', text: 'A nova senha já vale no próximo acesso.' },
        ],
      },
      {
        id: 'esqueci',
        title: 'Esqueci minha senha',
        paragraphs: [
          'Peça ao administrador para redefinir sua senha. Depois, entre com a senha que ele informar e troque por uma só sua.',
        ],
      },
    ],
    related: ['bater-ponto'],
  },
  {
    slug: 'aplicativo-do-colaborador',
    title: 'O aplicativo no computador da loja',
    summary:
      'Versão instalada, atualizações automáticas, tema escuro e o botão de atualizar os dados.',
    category: 'colaborador',
    audience: ['employee', 'admin'],
    keywords: ['versão', 'atualização', 'atualizar', 'aplicativo', 'tema', 'escuro', 'bandeja'],
    sections: [
      {
        id: 'versao',
        title: 'Versão e atualizações',
        image: {
          key: 'app-versao',
          alt: 'Selo de versão na tela de login',
          caption: 'Na tela de login aparece a versão instalada e se ela está atualizada.',
        },
        paragraphs: [
          'O PH-Ponto se atualiza sozinho. Quando há uma versão nova, ela é baixada em segundo plano e instalada quando o computador fica livre; o aplicativo fecha e abre de novo em poucos segundos.',
          'Se aparecer "pronta para instalar" e ninguém estiver usando, clique em Atualizar agora.',
        ],
      },
      {
        id: 'botoes',
        title: 'Botões do topo',
        bullets: [
          'Seta circular: atualiza seus dados e solicitações.',
          'Chave: troca a sua senha.',
          'Lua ou sol: alterna entre tema claro e escuro.',
          'Porta com seta: sai do aplicativo.',
        ],
      },
      {
        id: 'janela',
        title: 'Fechar a janela',
        paragraphs: [
          'Fechar a janela não encerra o PH-Ponto: ele continua perto do relógio do Windows e abre junto com o computador. Para abrir de novo, clique no ícone dele.',
        ],
      },
    ],
    related: ['bater-ponto', 'aplicativo-desktop'],
  },
];
