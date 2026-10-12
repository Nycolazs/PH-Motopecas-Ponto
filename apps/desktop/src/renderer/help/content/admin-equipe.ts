import type { HelpArticle } from '../help-types.js';

export const ADMIN_TEAM_ARTICLES: HelpArticle[] = [
  {
    slug: 'colaboradores',
    title: 'Cadastrar e gerenciar colaboradores',
    summary:
      'Crie o acesso de cada funcionário, edite dados, redefina senhas e desative quem saiu da empresa.',
    category: 'equipe',
    audience: ['admin'],
    keywords: [
      'funcionário',
      'cadastrar',
      'novo funcionário',
      'colaborador',
      'login',
      'senha',
      'redefinir senha',
      'desativar',
      'ativar',
      'foto',
    ],
    screen: { label: 'Colaboradores', path: '/admin/funcionarios' },
    sections: [
      {
        id: 'lista',
        title: 'A lista de colaboradores',
        image: { key: 'colaboradores', alt: 'Lista de colaboradores com filtros e ações' },
        paragraphs: [
          'A tela mostra todos os colaboradores com login, situação e data de cadastro. Use a busca por nome ou login e os filtros Todos, Ativos e Inativos.',
        ],
      },
      {
        id: 'cadastrar',
        title: 'Cadastrar um novo colaborador',
        steps: [
          {
            title: 'Clique em Novo Funcionário',
            text: 'O botão fica no topo da lista.',
          },
          {
            title: 'Preencha nome, login e senha inicial',
            text: 'O login é o que a pessoa vai digitar no aplicativo (por exemplo joao.silva). A senha inicial pode ser simples; peça para o colaborador trocar no primeiro acesso.',
            image: { key: 'novo-colaborador', alt: 'Janela Cadastrar Novo Funcionário' },
          },
          {
            title: 'Clique em Cadastrar',
            text: 'O colaborador já pode bater o ponto. Depois, abra Detalhes & Pontos para completar CPF, endereço, cargo e data de admissão.',
          },
        ],
      },
      {
        id: 'senha',
        title: 'Redefinir a senha de um colaborador',
        paragraphs: [
          'Na linha do colaborador, clique em Redefinir senha, digite a nova senha duas vezes e confirme. Avise a pessoa da nova senha; ela pode trocá-la depois no aplicativo.',
        ],
      },
      {
        id: 'foto',
        title: 'Foto do colaborador',
        paragraphs: [
          'Clique no avatar (as iniciais) do colaborador para enviar uma foto. A foto aparece no aplicativo e nos painéis.',
        ],
      },
      {
        id: 'desativar',
        title: 'Desativar quem saiu da empresa',
        paragraphs: [
          'Use Desativar na linha do colaborador para bloquear o acesso sem apagar nada: batidas, documentos e histórico continuam guardados. Se a pessoa voltar, use Ativar.',
          'Para registrar um desligamento formal, com motivo e data, use Desligar Colaborador na ficha dele.',
        ],
        warning: 'Nenhum colaborador é apagado: o histórico de ponto precisa ser mantido.',
      },
    ],
    related: ['ficha-do-colaborador', 'cargos-e-funcoes', 'aplicativo-desktop'],
  },
  {
    slug: 'ficha-do-colaborador',
    title: 'Ficha do colaborador',
    summary:
      'Tudo sobre uma pessoa em um só lugar: dados pessoais, cargo, ponto do mês, documentos, avaliações, histórico e acesso ao aplicativo.',
    category: 'equipe',
    audience: ['admin'],
    keywords: [
      'perfil',
      'detalhes',
      'cargo',
      'admissão',
      'desligamento',
      'demissão',
      'evento',
      'histórico',
      'acesso ao app',
      'calendário',
    ],
    screen: { label: 'Colaboradores', path: '/admin/funcionarios' },
    sections: [
      {
        id: 'abrir',
        title: 'Abrir a ficha',
        paragraphs: ['Em Colaboradores, clique em Detalhes & Pontos na linha da pessoa.'],
        image: { key: 'ficha-colaborador', alt: 'Ficha do colaborador com as abas' },
      },
      {
        id: 'abas',
        title: 'As abas da ficha',
        bullets: [
          'Resumo: dados pessoais, vínculo e cargo, atalhos para emitir documentos e a escala disciplinar.',
          'Ponto & Frequência: calendário do mês com o status de cada dia. Clique em um dia para ver e corrigir as batidas.',
          'Histórico: linha do tempo com admissão, mudanças de cargo, documentos, férias, acessos e medidas disciplinares.',
          'Documentos: todos os PDFs emitidos para a pessoa, com visualização e download.',
          'Avaliações: as avaliações de desempenho registradas.',
          'Acesso ao App: liberar ou tirar o acesso, gerar outra senha e encerrar sessões abertas.',
        ],
      },
      {
        id: 'cargo',
        title: 'Atribuir um cargo',
        paragraphs: [
          'Em Resumo › Vínculo Empregatício e Cargo, clique em Atribuir Cargo e escolha um dos cargos cadastrados. A mudança entra no histórico da pessoa.',
        ],
      },
      {
        id: 'eventos',
        title: 'Registrar eventos e desligamento',
        paragraphs: [
          'Registrar Evento anota fatos do vínculo, como mudança de função. Desligar Colaborador registra a saída com o motivo (sem justa causa, pedido de demissão, acordo…) e bloqueia o acesso. Reativar Vínculo desfaz um desligamento.',
        ],
      },
    ],
    related: ['colaboradores', 'registros-de-ponto', 'documentos-e-rh'],
  },
  {
    slug: 'relatorios-e-espelho',
    title: 'Relatórios e espelho de ponto',
    summary:
      'Feche o mês: resumo da equipe, espelho individual para assinatura, planilha e impressão.',
    category: 'relatorios',
    audience: ['admin'],
    keywords: [
      'espelho',
      'fechamento',
      'mês',
      'imprimir',
      'planilha',
      'excel',
      'csv',
      'exportar',
      'folha de ponto',
      'relatório',
      'pdf',
    ],
    screen: { label: 'Relatórios & Espelho', path: '/admin/relatorios' },
    sections: [
      {
        id: 'equipe',
        title: 'Resumo da equipe',
        steps: [
          {
            title: 'Escolha o período',
            text: 'Em Tipo de período, use Mês (com as setas para mês anterior e próximo) ou Personalizado para escolher datas de início e fim.',
            image: { key: 'relatorios-equipe', alt: 'Relatório com o resumo da equipe no mês' },
          },
          {
            title: 'Confira os totais',
            text: 'A tabela mostra, por colaborador, o previsto, o trabalhado, o saldo, as horas extras, as faltas e atrasos e as pendências. Se houver pendências, use Revisar pendências antes de fechar.',
          },
          {
            title: 'Exporte ou imprima',
            text: 'Exportar planilha baixa um arquivo CSV que abre no Excel. Imprimir resumo gera a folha da equipe, e Imprimir espelhos gera o espelho de todos de uma vez.',
          },
        ],
      },
      {
        id: 'individual',
        title: 'Espelho individual',
        steps: [
          {
            title: 'Abra o espelho de uma pessoa',
            text: 'Clique em Espelho na linha do colaborador, ou escolha Espelho individual em Tipo de relatório.',
            image: {
              key: 'relatorio-espelho',
              alt: 'Espelho de ponto individual de um colaborador',
            },
          },
          {
            title: 'Navegue entre colaboradores',
            text: 'As setas ao lado do nome levam ao colaborador anterior e ao próximo.',
          },
          {
            title: 'Imprima para assinatura',
            text: 'Em Imprimir / Salvar PDF, escolha a impressora ou "Salvar como PDF". O espelho traz o cabeçalho da empresa e o campo de assinatura.',
          },
        ],
        tip: 'Mostrar inativos inclui no relatório quem foi desativado no período.',
      },
    ],
    related: ['espelhos-incompletos', 'calculo-de-horas'],
  },
];

export const ADMIN_SETTINGS_ARTICLES: HelpArticle[] = [
  {
    slug: 'jornadas-e-calendario',
    title: 'Jornadas, feriados e férias',
    summary:
      'Defina o horário semanal da loja, cadastre feriados e dias especiais e registre as férias da equipe.',
    category: 'configuracoes',
    audience: ['admin'],
    keywords: [
      'jornada',
      'horário',
      'expediente',
      'escala',
      'feriado',
      'férias',
      'almoço',
      'sábado',
      'horário especial',
      'fechado',
      '44 horas',
    ],
    screen: { label: 'Jornadas & Regras', path: '/admin/configuracoes' },
    sections: [
      {
        id: 'horario-semanal',
        title: 'Horário semanal',
        image: { key: 'jornadas', alt: 'Jornada vigente com os horários de cada dia' },
        paragraphs: [
          'A aba Horário semanal mostra a jornada em vigor: horário de abertura e fechamento de cada dia, se há uma hora de almoço e o total de horas.',
        ],
      },
      {
        id: 'nova-jornada',
        title: 'Mudar a jornada',
        steps: [
          {
            title: 'Clique em Nova jornada',
            text: 'Você pode partir de um modelo pronto (44h com sábado, 44h sem sábado, 40h ou 30h) e ajustar cada dia.',
            image: { key: 'nova-jornada', alt: 'Janela de nova jornada com modelos prontos' },
          },
          {
            title: 'Escolha a data de início',
            text: 'Em Data de Início da Vigência, informe a partir de quando os novos horários valem. Os dias anteriores continuam calculados com a jornada antiga.',
          },
          {
            title: 'Salve',
            text: 'A versão anterior fica no Histórico de Versões da Jornada.',
          },
        ],
        tip: 'O botão Replicar Seg ➔ Sex copia o horário de segunda-feira para terça a sexta.',
      },
      {
        id: 'feriados',
        title: 'Feriados e exceções',
        image: { key: 'feriados', alt: 'Lista de feriados e exceções cadastradas' },
        paragraphs: [
          'Em Feriados e exceções, clique em Adicionar Feriado / Exceção e escolha o tipo: Feriado (ninguém trabalha), Fechado Administrativo (expediente suspenso) ou Horário Especial (por exemplo, abrir só pela manhã). As exceções valem só para aquela data e substituem o horário semanal.',
        ],
      },
      {
        id: 'ferias',
        title: 'Férias',
        steps: [
          {
            title: 'Abra a aba Férias e clique em Cadastrar Férias',
            text: 'Escolha o colaborador e as datas de início e fim.',
            image: { key: 'ferias', alt: 'Aba de férias com um período cadastrado' },
          },
          {
            title: 'Confirme',
            text: 'Nos dias de férias o esperado é zero e o dia aparece como Férias no espelho. Para desfazer, use Cancelar período de férias na linha correspondente.',
          },
        ],
      },
    ],
    related: ['calculo-de-horas', 'regimento-interno'],
  },
  {
    slug: 'minha-empresa',
    title: 'Dados da empresa',
    summary:
      'Razão social, CNPJ, endereço e contatos que aparecem nos documentos e espelhos de ponto.',
    category: 'configuracoes',
    audience: ['admin'],
    keywords: ['empresa', 'cnpj', 'razão social', 'endereço', 'cabeçalho', 'nome fantasia'],
    screen: { label: 'Minha Empresa', path: '/admin/empresa' },
    sections: [
      {
        id: 'preencher',
        title: 'Preencher e salvar',
        image: { key: 'empresa', alt: 'Formulário Minha Empresa' },
        paragraphs: [
          'Preencha a identificação cadastral (razão social, nome fantasia, CNPJ, inscrição estadual) e o endereço e contato. Clique em Salvar Alterações.',
          'Os documentos já emitidos não mudam; os próximos já saem com os dados novos.',
        ],
      },
    ],
    related: ['relatorios-e-espelho', 'documentos-e-rh'],
  },
  {
    slug: 'cargos-e-funcoes',
    title: 'Cargos e funções',
    summary:
      'Descreva as atribuições e os requisitos de cada cargo. Cada alteração gera uma nova versão.',
    category: 'configuracoes',
    audience: ['admin'],
    keywords: ['cargo', 'função', 'cbo', 'atribuições', 'requisitos', 'setor', 'departamento'],
    screen: { label: 'Cargos & Funções', path: '/admin/cargos' },
    sections: [
      {
        id: 'novo',
        title: 'Cadastrar um cargo',
        steps: [
          {
            title: 'Clique em Novo cargo',
            text: 'Informe o título, o setor, o código CBO (opcional) e a descrição das atribuições.',
            image: { key: 'novo-cargo', alt: 'Janela Cadastrar Novo Cargo' },
          },
          {
            title: 'Liste responsabilidades e requisitos',
            text: 'Digite cada item e clique em Adicionar. Eles aparecem no Termo de Ciência do Cargo.',
          },
          {
            title: 'Clique em Salvar Cargo',
            text: 'O cargo já pode ser atribuído aos colaboradores.',
          },
        ],
      },
      {
        id: 'versoes',
        title: 'Alterar um cargo',
        image: { key: 'cargos', alt: 'Lista de cargos cadastrados' },
        paragraphs: [
          'Abra Ver Detalhes e use Publicar Nova Versão. As versões antigas ficam guardadas para que os termos já assinados continuem fazendo sentido.',
        ],
      },
    ],
    related: ['termos-de-ciencia', 'ficha-do-colaborador'],
  },
  {
    slug: 'administradores',
    title: 'Contas de administrador',
    summary: 'Crie acessos para gestores, redefina senhas e desative contas.',
    category: 'configuracoes',
    audience: ['admin'],
    keywords: ['administrador', 'gestor', 'gerente', 'acesso', 'senha admin', 'permissão'],
    screen: { label: 'Administradores', path: '/admin/administradores' },
    sections: [
      {
        id: 'novo',
        title: 'Criar um administrador',
        image: { key: 'administradores', alt: 'Lista de contas de administrador' },
        steps: [
          { title: 'Clique em Novo Administrador', text: 'Informe nome, login e senha inicial.' },
          {
            title: 'Clique em Cadastrar Admin',
            text: 'A pessoa já pode entrar no painel com acesso total.',
          },
        ],
        warning:
          'Todo administrador vê e altera tudo: pontos, documentos e outros administradores. Crie contas apenas para quem precisa.',
      },
      {
        id: 'senha-desativar',
        title: 'Redefinir senha e desativar',
        paragraphs: [
          'Use Redefinir senha quando alguém esquecer a senha. Desativar bloqueia o acesso. O sistema não deixa desativar o último administrador ativo, para ninguém ficar sem acesso ao painel.',
        ],
      },
    ],
    related: ['acessar-o-sistema', 'trilha-de-auditoria'],
  },
  {
    slug: 'alertas-no-whatsapp',
    title: 'Alertas de atraso no WhatsApp',
    summary:
      'Receba no WhatsApp o nome e o horário de quem chegou atrasado, enviado pelo número da loja.',
    category: 'configuracoes',
    audience: ['admin'],
    keywords: ['whatsapp', 'alerta', 'atraso', 'notificação', 'qr code', 'mensagem', 'aviso'],
    screen: { label: 'Alertas no WhatsApp', path: '/admin/notificacoes' },
    sections: [
      {
        id: 'conectar',
        title: 'Conectar o WhatsApp da loja',
        image: { key: 'whatsapp', alt: 'Tela Alertas no WhatsApp' },
        steps: [
          {
            title: 'Clique em Conectar WhatsApp',
            text: 'Um QR Code aparece na tela. Use de preferência um chip só para isso.',
          },
          {
            title: 'Leia o QR Code com o celular',
            text: 'No WhatsApp do celular da loja, abra Aparelhos conectados › Conectar um aparelho e aponte a câmera para o código.',
          },
          {
            title: 'Aguarde o status Conectado',
            text: 'A partir daí as mensagens saem desse número.',
          },
        ],
      },
      {
        id: 'regra',
        title: 'A regra do atraso',
        paragraphs: [
          'Com Enviar alerta de atraso marcado, se a primeira entrada do dia for registrada depois do horário de abertura mais a tolerância, os administradores marcados recebem o nome do colaborador e a hora em que entrou. Folgas, feriados e férias não geram alerta.',
          'A tolerância vem do Regimento Interno em vigor. Para mudá-la, use Alterar no Regimento.',
        ],
      },
      {
        id: 'destinatarios',
        title: 'Quem recebe os alertas',
        steps: [
          {
            title: 'Informe o WhatsApp de cada administrador',
            text: 'Digite o número com DDD; a máscara (85) 99999-0000 é aplicada sozinha.',
          },
          {
            title: 'Marque Recebe alertas de atraso e salve',
            text: 'Use Testar para mandar uma mensagem de teste e conferir se chegou.',
          },
        ],
      },
      {
        id: 'historico',
        title: 'Últimas mensagens',
        paragraphs: [
          'No fim da página fica a lista das mensagens enviadas, com a situação de cada uma (Enviada ou Falhou, com o motivo da falha).',
        ],
      },
    ],
    related: ['regimento-interno', 'calculo-de-horas'],
  },
  {
    slug: 'trilha-de-auditoria',
    title: 'Trilha de auditoria',
    summary: 'O registro de tudo o que foi feito no sistema: quem, quando, o quê e por quê.',
    category: 'configuracoes',
    audience: ['admin'],
    keywords: ['auditoria', 'log', 'quem alterou', 'histórico', 'registro', 'segurança'],
    screen: { label: 'Trilha de Auditoria', path: '/admin/auditoria' },
    sections: [
      {
        id: 'consultar',
        title: 'Consultar',
        image: { key: 'auditoria', alt: 'Registro de auditoria com filtros' },
        paragraphs: [
          'Cada linha mostra a data e hora, a ação, o resultado, quem fez, sobre quem e o motivo informado. Use Filtrar por Tipo de Ação para achar, por exemplo, todas as correções de ponto, e Ver Detalhes para os dados completos.',
          'A auditoria não pode ser editada nem apagada por ninguém, nem pelos administradores.',
        ],
      },
    ],
    related: ['registros-de-ponto', 'administradores'],
  },
  {
    slug: 'aplicativo-desktop',
    title: 'Aplicativo PH-Ponto no computador da loja',
    summary:
      'Instale o aplicativo onde a equipe bate o ponto. Ele se atualiza sozinho e mostra a versão na tela de login.',
    category: 'configuracoes',
    audience: ['admin'],
    keywords: [
      'instalar',
      'download',
      'baixar',
      'windows',
      'aplicativo',
      'atualização',
      'versão',
      'exe',
      'mac',
      'linux',
    ],
    screen: { label: 'Aplicativo Desktop', path: '/admin/aplicativo' },
    sections: [
      {
        id: 'instalar',
        title: 'Instalar no Windows',
        steps: [
          {
            title: 'Baixe o instalador',
            text: 'Em Aplicativo Desktop, clique em Baixar Instalador Windows (.exe).',
            image: { key: 'aplicativo-download', alt: 'Página de download do aplicativo' },
          },
          {
            title: 'Execute o arquivo',
            text: 'Se o Windows mostrar "O Windows protegeu o computador", clique em Mais informações › Executar assim mesmo. Siga o instalador.',
          },
          {
            title: 'Pronto',
            text: 'Um atalho PH-Ponto aparece na área de trabalho. O aplicativo abre junto com o Windows e fica no relógio do sistema (bandeja) quando a janela é fechada.',
          },
        ],
      },
      {
        id: 'atualizacoes',
        title: 'Atualizações automáticas',
        image: {
          key: 'app-versao',
          alt: 'Selo de versão na tela de login do aplicativo',
          caption: 'A tela de login mostra a versão instalada e o andamento da atualização.',
        },
        bullets: [
          'O aplicativo procura versões novas ao abrir, a cada 30 minutos e quando o computador volta da suspensão.',
          'A versão nova é baixada em segundo plano e instalada sozinha quando ninguém está usando o computador. Depois o aplicativo reabre.',
          'Se aparecer "pronta para instalar", clique em Atualizar agora para instalar na hora.',
          'Se aparecer "Falha ao verificar", confira a internet; o aplicativo tenta de novo sozinho.',
        ],
        warning:
          'No Mac, a atualização automática não funciona: baixe e instale a versão nova manualmente por esta página.',
      },
    ],
    related: ['bater-ponto', 'primeiros-passos'],
  },
];
