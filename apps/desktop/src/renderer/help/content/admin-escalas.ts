import type { HelpArticle } from '../help-types.js';

export const ADMIN_SCHEDULE_ARTICLES: HelpArticle[] = [
  {
    slug: 'escalas-e-folgas',
    title: 'Escalas e folgas (5x2)',
    summary:
      'Monte a escala de cada pessoa, troque folgas e veja quem trabalha em cada dia. Inclui a mudança para 2 folgas por semana em dezembro de 2026.',
    category: 'ponto',
    audience: ['admin'],
    keywords: [
      'escala',
      '5x2',
      '6x1',
      'folga',
      'folgas',
      'trocar folga',
      'troca',
      'domingo',
      'sábado',
      'rodízio',
      'jornada',
      'EC 141',
      '40 horas',
      '42 horas',
      'plantão',
    ],
    screen: { label: 'Abrir Escalas e Folgas', path: '/admin/escalas' },
    sections: [
      {
        id: 'o-que-muda',
        title: 'O que muda com a escala 5x2',
        paragraphs: [
          'A partir de 15/12/2026 cada colaborador passa a ter 2 folgas por semana e no máximo 42 horas semanais. Sem acordo coletivo com o sindicato, cada dia continua limitado a 8 horas, então na prática são 40 horas. Em dezembro de 2027 o limite passa a ser 40 horas para todos.',
          'O salário não pode ser reduzido. Uma das folgas deve ser, de preferência, no domingo, e as duas não precisam ser seguidas.',
        ],
        warning:
          'O sistema ajuda a montar a escala dentro das regras, mas não substitui a orientação do contador ou do sindicato.',
      },
      {
        id: 'grade',
        title: 'Entender a grade da equipe',
        bullets: [
          'Cada linha é um colaborador e cada coluna um dia da semana.',
          'Verde mostra o horário de trabalho; cinza é folga; roxo é feriado; azul é férias.',
          'A coluna Semana soma as horas planejadas e mostra quantas folgas a pessoa tem. O ícone vermelho indica que algo está fora das regras.',
          'A última linha mostra quantas pessoas trabalham em cada dia. Fica vermelha quando está abaixo do mínimo definido em Regras da empresa.',
          'Quem ainda não tem escala própria segue o horário da loja (Jornadas & Regras).',
        ],
      },
      {
        id: 'montar',
        title: 'Montar a escala de uma pessoa',
        steps: [
          {
            title: 'Clique em Montar escala',
            text: 'O link fica embaixo do nome de cada colaborador na grade.',
          },
          {
            title: 'Escolha a data de início',
            text: 'A escala vale do dia escolhido em diante. O ponto que já foi registrado não muda. Para a mudança da lei, use 15/12/2026.',
          },
          {
            title: 'Escolha um modelo',
            text: 'Sábado e domingo de folga; domingo mais um dia fixo; ou rodízio de 2 semanas, em que a segunda folga muda de uma semana para a outra.',
          },
          {
            title: 'Ajuste os horários',
            text: 'Informe entrada, saída e almoço e clique em Usar em todos os dias de trabalho. Se algum dia for diferente, altere só ele na tabela.',
          },
          {
            title: 'Confira e salve',
            text: 'A conferência mostra as horas de cada semana e explica qualquer problema (mais de 40 horas, só 1 folga, almoço curto…). Corrija e clique em Salvar escala.',
          },
        ],
        tip: 'Escalonar o almoço (11h30 e 12h30, por exemplo) evita que a loja fique vazia no horário de almoço.',
      },
      {
        id: 'trocar-folga',
        title: 'Trocar uma folga ou mudar só um dia',
        paragraphs: [
          'Clique no dia na grade. Numa folga, escolha Trocar esta folga de dia e diga qual dia vira a nova folga. Num dia de trabalho, você pode dar folga só naquele dia, trocar com uma folga ou mudar o horário apenas naquela data.',
          'O motivo é obrigatório e fica registrado na trilha de auditoria. Os dias trocados aparecem marcados com "troca" ou "ajuste". Para voltar atrás, clique no dia e use Desfazer.',
        ],
      },
      {
        id: 'regras',
        title: 'Regras da empresa',
        bullets: [
          'Acordo coletivo: responda Sim apenas se houver acordo ou convenção que permita 8h24 por dia. Na dúvida, use Não sei: o sistema considera 40 horas, o limite mais seguro.',
          'Domingo: quem trabalha aos domingos deve folgar um domingo a cada 3 semanas (regra do comércio) ou a cada 2 semanas (mais conservador).',
          'Mínimo de pessoas: quantas pessoas precisam trabalhar em cada dia que a loja abre.',
        ],
      },
      {
        id: 'ponto',
        title: 'Como a escala aparece no ponto',
        bullets: [
          'Nas folgas da escala o dia não conta como falta e aparece como Folga no histórico e no espelho.',
          'As horas esperadas de cada dia passam a ser as da escala da pessoa, e o alerta de atraso usa o horário de entrada dela.',
          'Feriados, férias, abonos e atestados continuam valendo por cima da escala.',
        ],
      },
    ],
    related: ['jornadas-e-calendario', 'painel-operacional', 'relatorios-e-espelho'],
  },
];
