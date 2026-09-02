import { useEffect, useMemo, useState } from 'react';
import {
  Activity, Archive, ArrowLeft, Bell, BookOpen, CalendarDays, Camera,
  ChevronDown, ChevronRight, ClipboardList, Clock3, FileText, FlaskConical,
  FolderOpen, GraduationCap, HeartPulse, Home, LogOut, Menu, MoreHorizontal,
  Paperclip, Plus, Search, Settings, ShieldCheck, Stethoscope, Upload, UserPlus,
  Users, X, Eye, EyeOff, LockKeyhole, Mail, Download, CheckCircle2, Pencil, Trash2,
} from 'lucide-react';
import { patients as seedPatients, statusTone } from './data';

const CURRENT_SEMESTER = '2026.2';

const navItems = [
  { label: 'Visão geral', icon: Home },
  { label: 'Meus casos', icon: ClipboardList },
  { label: 'Novo paciente', icon: UserPlus },
  { label: 'Evoluções', icon: Activity },
  { label: 'Arquivos', icon: FolderOpen },
];

const adminItems = [
  { label: 'Todos os casos', icon: BookOpen },
  { label: 'Usuários', icon: Users },
  { label: 'Google Drive', icon: FolderOpen },
  { label: 'Relatórios', icon: FileText },
];

const demoAccounts = [
  { id: 'student-joao', name: 'João da Silva', email: 'joao@academico.ufpb.br', password: 'aluno123', role: 'student', registration: '20260001' },
  { id: 'student-maria', name: 'Maria dos Santos', email: 'maria@academico.ufpb.br', password: 'aluno123', role: 'student', registration: '20260002' },
  { id: 'admin-helena', name: 'Helena Moura', email: 'helena@ufpb.br', password: 'professor123', role: 'admin', registration: 'SIAPE 1234567' },
];

function Logo() {
  return <div className="brand"><div className="sidebar-brand-lockup"><img className="brand-logo" src="/assets/logo-clinica-estomatologia-ufpb.png" alt="Clínica de Estomatologia UFPB – Gestão, Registro e Evolução"/><img className="partner-logo" src="/assets/logo-labodigit-ufpb.jpg" alt="LaboDigit – Laboratório de Odontologia Digital PPGO/UFPB"/></div></div>;
}

function AuthPage({ accounts, onAuth, onRegister }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email')).trim().toLowerCase(); const password = String(form.get('password'));
    if (mode === 'login') {
      const account = accounts.find(item => item.email.toLowerCase() === email && item.password === password && item.role === role);
      if (!account) { setError('E-mail, senha ou perfil não conferem. Verifique os dados e tente novamente.'); return; }
      setError(''); onAuth(account); return;
    }
    if (password !== form.get('confirmation')) { setError('As senhas informadas não são iguais.'); return; }
    if (accounts.some(item => item.email.toLowerCase() === email)) { setError('Este e-mail já possui cadastro.'); return; }
    const account = { id: `user-${Date.now()}`, role, name: form.get('name'), email, password, registration: form.get('registration') };
    onRegister(account); setError(''); onAuth(account);
  };
  return <div className="auth-page">
    <section className="auth-intro">
      <div className="auth-brand-lockup"><div className="auth-brand"><img src="/assets/logo-clinica-estomatologia-ufpb.png" alt="Clínica de Estomatologia UFPB"/></div><div className="auth-partner-brand"><img src="/assets/logo-labodigit-ufpb.jpg" alt="LaboDigit – Laboratório de Odontologia Digital PPGO/UFPB"/></div></div>
      <div className="auth-copy"><p className="auth-kicker"><span/>CLÍNICA-ESCOLA · UNIVERSIDADE FEDERAL DA PARAÍBA</p><h1>Cuidado clínico,<br/>aprendizado e <em>evolução.</em></h1><p>Um ambiente seguro para organizar Guias Clínicos, acompanhar casos e registrar a evolução longitudinal dos pacientes atendidos pelos alunos da UFPB.</p>
        <div className="auth-benefits"><div><span><ClipboardList size={19}/></span><p><strong>Guia Clínico organizado</strong><small>Dados clínicos reunidos em um só lugar.</small></p></div><div><span><Activity size={19}/></span><p><strong>Acompanhamento longitudinal</strong><small>Evoluções, imagens e documentos em uma linha do tempo.</small></p></div><div><span><ShieldCheck size={19}/></span><p><strong>Acesso individual</strong><small>Cada aluno acessa somente os pacientes da sua conta.</small></p></div></div>
      </div><p className="auth-university">© 2026 Universidade Federal da Paraíba · Ambiente acadêmico</p>
    </section>
    <section className="auth-access"><div className="auth-card"><div className="auth-card-head"><span className="auth-card-icon"><Stethoscope size={22}/></span><p className="eyebrow">ACESSO AO SISTEMA</p><h2>{mode === 'login' ? 'Bem-vindo de volta' : 'Criar uma conta'}</h2><p>{mode === 'login' ? 'Entre com suas credenciais institucionais.' : 'Cadastre seu acesso acadêmico ao sistema.'}</p></div>
      <div className="auth-tabs"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('')}}>Entrar</button><button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setError('')}}>Cadastrar</button></div>
      <form className="auth-form" onSubmit={submit}>
        <div className="role-choice"><button type="button" className={role==='student'?'active':''} onClick={()=>setRole('student')}><GraduationCap size={20}/><span><strong>Aluno</strong><small>Acesso individual</small></span></button><button type="button" className={role==='admin'?'active':''} onClick={()=>setRole('admin')}><Stethoscope size={20}/><span><strong>Professor</strong><small>Supervisão geral</small></span></button></div>
        {mode === 'register' && <><label>Nome completo<div className="auth-input"><Users size={17}/><input name="name" required placeholder="Seu nome completo"/></div></label><label>{role==='student'?'Matrícula':'SIAPE'}<div className="auth-input"><ClipboardList size={17}/><input name="registration" required placeholder={role==='student'?'Ex.: 20260001':'Ex.: 1234567'}/></div></label></>}
        <label>E-mail institucional<div className="auth-input"><Mail size={17}/><input name="email" type="email" required placeholder="nome@academico.ufpb.br"/></div></label>
        <label>Senha<div className="auth-input"><LockKeyhole size={17}/><input name="password" type={showPassword?'text':'password'} required minLength="6" placeholder="Digite sua senha"/><button type="button" onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
        {mode === 'register' && <label>Confirmar senha<div className="auth-input"><LockKeyhole size={17}/><input name="confirmation" type="password" required minLength="6" placeholder="Repita sua senha"/></div></label>}
        {error && <div className="auth-error">{error}</div>}
        {mode === 'login' && <div className="auth-options"><label><input type="checkbox"/>Lembrar acesso</label><button type="button">Esqueci minha senha</button></div>}
        <button className="primary auth-submit" type="submit">{mode==='login'?'Entrar no sistema':'Criar cadastro'}<ChevronRight size={17}/></button>
      </form>
      <div className="auth-security"><ShieldCheck size={15}/><span>Ambiente acadêmico com acesso individual e protegido</span></div>
    </div></section>
  </div>;
}

function Badge({ status }) {
  return <span className={`badge ${statusTone[status] || 'gray'}`}><i />{status}</span>;
}

function Avatar({ patient, small = false }) {
  return <span className={`avatar ${small ? 'small' : ''}`} style={{ background: patient.accent }}>{patient.initials}</span>;
}

function Sidebar({ active, setActive, isAdmin, mobileOpen, setMobileOpen, user, onLogout }) {
  const select = (label) => { setActive(label); setMobileOpen(false); };
  return <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
    <div className="side-top"><Logo /><button className="icon-button close-menu" onClick={() => setMobileOpen(false)}><X size={20}/></button></div>
    <nav>
      <p className="nav-caption">ATENDIMENTO</p>
      {navItems.map(({label, icon: Icon}) => <button key={label} className={active === label ? 'active' : ''} onClick={() => select(label)}><Icon size={19}/><span>{label}</span>{label === 'Meus casos' && <em>3</em>}</button>)}
      {isAdmin && <><p className="nav-caption admin-caption">ADMINISTRAÇÃO</p>{adminItems.map(({label, icon: Icon}) => <button key={label} className={active === label ? 'active' : ''} onClick={() => select(label)}><Icon size={19}/><span>{label}</span></button>)}</>}
    </nav>
    <div className="side-bottom">
      <div className="role-switch">
        <ShieldCheck size={18}/><span><small>Perfil conectado</small>{isAdmin ? 'Professor' : 'Aluno'}</span><CheckCircle2 size={16}/>
      </div>
      <div className="profile"><div className="profile-avatar">{(user?.name || 'JS').split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}</div><div><strong>{user?.name || 'João da Silva'}</strong><span>{isAdmin ? 'Professor administrador' : `Aluno · Matrícula ${user?.registration}`}</span></div><button className="profile-logout" onClick={onLogout} title="Sair"><LogOut size={17}/></button></div>
    </div>
  </aside>;
}

function Header({ setMobileOpen, isAdmin, semester }) {
  return <header className="topbar">
    <button className="icon-button menu-button" onClick={() => setMobileOpen(true)}><Menu size={22}/></button>
    <div className="breadcrumb"><span>Clínica-escola</span><ChevronRight size={14}/><strong>Período {semester}</strong></div>
    <div className="top-actions"><button className="icon-button notification"><Bell size={19}/><i/></button><div className="term"><CalendarDays size={16}/><span>{isAdmin ? 'Visão geral' : 'Acesso individual'}</span></div></div>
  </header>;
}

function StatCard({ icon: Icon, value, label, note, tone }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={21}/></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>;
}

function Dashboard({ setActive, openPatient, isAdmin, patients, user, semester }) {
  const visible = patients.filter(p => (isAdmin || p.ownerId === user.id) && p.semester === semester);
  return <main className="page dashboard-page">
    <div className="welcome-row"><div><p className="eyebrow">QUARTA-FEIRA, 2 DE SETEMBRO</p><h1>Bom dia, {user.name.split(' ')[0]}.</h1><p>{isAdmin ? 'Aqui está o panorama atual da clínica.' : 'Aqui estão os pacientes cadastrados em sua conta.'}</p></div><button className="primary" onClick={() => setActive('Novo paciente')}><Plus size={18}/>Novo paciente</button></div>
    <section className="stats-grid">
      <StatCard icon={ClipboardList} value={visible.length} label={isAdmin ? 'Pacientes cadastrados' : 'Meus pacientes'} note={`no período ${semester}`} tone="mint"/>
      <StatCard icon={Activity} value={visible.filter(p => p.status !== 'Concluído').length} label="Casos ativos" note="em atendimento" tone="sand"/>
      <StatCard icon={Clock3} value={visible.filter(p => p.status.includes('Aguardando')).length} label="Pendências" note="requerem atenção" tone="rose"/>
      <StatCard icon={ShieldCheck} value={visible.filter(p => p.status === 'Concluído').length} label="Casos concluídos" note="neste período" tone="blue"/>
    </section>
    <section className="content-grid">
      <div className="panel recent-panel"><div className="panel-heading"><div><h2>Casos recentes</h2><p>{isAdmin ? 'Últimos pacientes cadastrados na clínica' : 'Últimos pacientes cadastrados por você'}</p></div><button className="text-button" onClick={() => setActive(isAdmin ? 'Todos os casos' : 'Meus casos')}>Ver todos <ChevronRight size={16}/></button></div>
        <div className="patient-list">{visible.slice(0,4).map(p => <button className="patient-row" key={p.id} onClick={() => openPatient(p)}><Avatar patient={p}/><div className="patient-main"><strong>{p.name}</strong><span>Ficha {p.ficha} · {p.age} anos</span></div><div className="patient-date"><span>Última consulta</span><strong>{p.lastVisit}</strong></div><Badge status={p.status}/><ChevronRight className="row-arrow" size={18}/></button>)}{!visible.length&&<div className="dashboard-empty"><ClipboardList size={25}/><strong>Nenhum paciente cadastrado</strong><span>Utilize “Novo paciente” para iniciar o primeiro Guia Clínico.</span></div>}</div>
      </div>
      <div className="panel agenda-panel"><div className="panel-heading"><div><h2>Próximos passos</h2><p>Pendências dos seus casos</p></div><button className="icon-button"><MoreHorizontal size={19}/></button></div>
        <div className="agenda-date"><strong>SET</strong><span>02</span><small>Hoje</small></div>
        <div className="agenda-items">{visible.length ? <div><i className="dot green"/><span><strong>Acompanhar casos ativos</strong><small>Consulte os Guias Clínicos para registrar evoluções</small></span></div> : <div className="agenda-empty"><CheckCircle2 size={20}/><span><strong>Nenhuma pendência</strong><small>As atividades aparecerão após o cadastro de pacientes.</small></span></div>}</div>
        <div className="privacy-note"><ShieldCheck size={18}/><span><strong>Dados protegidos</strong><small>Acesso registrado para fins de auditoria.</small></span></div>
      </div>
    </section>
    <section className="quick-section"><h2>Acesso rápido</h2><div className="quick-grid"><button onClick={() => setActive('Evoluções')}><span><Activity size={20}/></span><div><strong>Registrar evolução</strong><small>Adicione um novo retorno clínico</small></div><ChevronRight size={17}/></button><button onClick={() => setActive('Arquivos')}><span><Upload size={20}/></span><div><strong>Enviar arquivo</strong><small>Fotografias, exames ou laudos</small></div><ChevronRight size={17}/></button><button onClick={() => setActive(isAdmin ? 'Todos os casos' : 'Meus casos')}><span><Search size={20}/></span><div><strong>Localizar paciente</strong><small>Busque por nome ou ficha</small></div><ChevronRight size={17}/></button></div></section>
  </main>;
}

function CasesPage({ isAdmin, openPatient, patients, user, semester, semesters, onSemesterChange }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const visible = useMemo(() => patients.filter(p => p.semester === semester && (isAdmin || p.ownerId === user.id) && (`${p.name} ${p.ficha}`.toLowerCase().includes(query.toLowerCase())) && (filter === 'Todos' || p.status === filter)), [query, filter, semester, isAdmin, patients, user.id]);
  return <main className="page"><div className="page-title"><div><p className="eyebrow">GUIAS CLÍNICOS</p><h1>{isAdmin ? 'Todos os casos' : 'Meus casos'}</h1><p>{isAdmin ? 'Acompanhe todos os pacientes atendidos na clínica.' : 'Pacientes cadastrados e acompanhados por sua conta individual.'}</p></div><button className="primary"><Plus size={18}/>Novo paciente</button></div>
    <div className="semester-bar"><div><span className="semester-icon"><CalendarDays size={19}/></span><span><small>PERÍODO ACADÊMICO</small><strong>Casos do semestre {semester}</strong></span></div><label>Selecionar semestre<select value={semester} onChange={e=>onSemesterChange(e.target.value)}>{semesters.map(item=><option key={item}>{item}</option>)}</select></label></div>
    <div className="panel cases-panel"><div className="filters"><label className="search-field"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={`Buscar nos casos de ${semester}`}/></label><select value={filter} onChange={e=>setFilter(e.target.value)}><option>Todos</option><option>Em acompanhamento</option><option>Aguardando exame</option><option>Em avaliação</option><option>Aguardando biópsia</option><option>Concluído</option></select></div>
      <div className="table-wrap"><table><thead><tr><th>PACIENTE</th><th>FICHA</th>{isAdmin && <th>RESPONSÁVEL</th>}<th>ÚLTIMA CONSULTA</th><th>STATUS</th><th></th></tr></thead><tbody>{visible.map(p=><tr key={p.id} onClick={()=>openPatient(p)}><td><div className="table-person"><Avatar patient={p} small/><span><strong>{p.name}</strong><small>{p.age} anos · {p.sex}</small></span></div></td><td className="mono">{p.ficha}</td>{isAdmin && <td>{p.ownerName}</td>}<td>{p.lastVisit}</td><td><Badge status={p.status}/></td><td><ChevronRight size={17}/></td></tr>)}</tbody></table>{!visible.length && <div className="empty"><ClipboardList size={28}/><strong>Nenhum caso em {semester}</strong><span>Cadastre um novo paciente neste período acadêmico.</span></div>}</div>
    </div>
  </main>;
}

function PatientPage({ patient, goBack, user, onUpdate, onDelete }) {
  const [tab, setTab] = useState('Resumo');
  const [showEvolution, setShowEvolution] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [caseData, setCaseData] = useState(patient);
  const updateCase = changes => { const updated = {...caseData, ...changes}; setCaseData(updated); onUpdate(updated); };
  const saveEvolution = evolution => { updateCase({ timeline: [evolution, ...(caseData.timeline || [])], lastVisit: evolution.displayDate }); setTab('Evoluções'); };
  return <main className="patient-page">
    <div className="patient-hero"><button className="back-link" onClick={goBack}><ArrowLeft size={17}/> Voltar para meus casos</button><div className="patient-heading"><Avatar patient={caseData}/><div><p className="eyebrow">FICHA {caseData.ficha} · SEMESTRE {caseData.semester}</p><h1>{caseData.name}</h1><p>{caseData.age} anos · {caseData.sex} · Responsável: {caseData.ownerName}</p></div><Badge status={caseData.status}/>{user.role==='admin'&&<div className="admin-patient-actions"><button className="secondary" onClick={()=>setShowEdit(true)}><Pencil size={16}/>Editar cadastro</button><button className="danger-button" onClick={()=>{if(window.confirm(`Remover o cadastro de ${caseData.name}? Esta ação não pode ser desfeita.`))onDelete(caseData.id)}}><Trash2 size={16}/>Remover</button></div>}<button className="primary" onClick={()=>setShowEvolution(true)}><Plus size={18}/>Nova evolução</button></div><div className="tabs">{['Resumo','Evoluções'].map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</div></div>
    <div className="patient-content">{tab === 'Resumo' ? <SummaryView patient={caseData} onUpdate={updateCase}/> : <EvolutionsView patient={caseData} onAdd={()=>setShowEvolution(true)}/>}</div>
    {showEvolution && <EvolutionModal patient={caseData} user={user} onSave={saveEvolution} close={()=>setShowEvolution(false)}/>} {showEdit&&<PatientEditModal patient={caseData} onSave={changes=>{updateCase(changes);setShowEdit(false)}} close={()=>setShowEdit(false)}/>} 
  </main>;
}

function PatientEditModal({ patient, onSave, close }) {
  const submit = event => { event.preventDefault(); const form = new FormData(event.currentTarget); const name = form.get('name'); onSave({ name, ficha: form.get('record'), age: Number(form.get('age')), sex: form.get('sex'), status: form.get('status'), initials: name.split(' ').slice(0,2).map(item=>item[0]).join('').toUpperCase() }); };
  return <div className="modal-layer" onMouseDown={event=>event.target===event.currentTarget&&close()}><div className="modal compact-modal"><div className="modal-head"><div><p className="eyebrow">ADMINISTRAÇÃO</p><h2>Editar paciente</h2><span>Atualize os dados de identificação e o status do caso.</span></div><button className="icon-button" onClick={close}><X size={20}/></button></div><form onSubmit={submit}><label>Nome completo<input name="name" required defaultValue={patient.name}/></label><div className="form-row"><label>Número da ficha<input name="record" required defaultValue={patient.ficha}/></label><label>Idade<input name="age" required type="number" min="0" defaultValue={patient.age}/></label></div><div className="form-row"><label>Sexo<select name="sex" defaultValue={patient.sex}><option>Feminino</option><option>Masculino</option><option>Outro</option><option>Prefere não informar</option></select></label><label>Status<select name="status" defaultValue={patient.status}><option>Em avaliação</option><option>Aguardando exame</option><option>Aguardando biópsia</option><option>Em acompanhamento</option><option>Concluído</option><option>Alta</option></select></label></div><div className="modal-actions"><button type="button" className="ghost" onClick={close}>Cancelar</button><button className="primary" type="submit"><ShieldCheck size={16}/>Salvar alterações</button></div></form></div></div>;
}

function SummaryView({ patient, onUpdate }) {
  const [editingDiagnosis, setEditingDiagnosis] = useState(false);
  const saveDiagnosis = event => { event.preventDefault(); const form = new FormData(event.currentTarget); onUpdate({ finalDiagnosis: form.get('diagnosis'), diagnosisConfirmation: form.get('confirmation'), diagnosisDate: '02 set 2026' }); setEditingDiagnosis(false); };
  return <><div className="summary-grid"><section className="panel info-panel"><div className="panel-heading"><div><h2>Resumo clínico</h2><p>Informações do preenchimento inicial</p></div></div><dl><div><dt>Queixa principal</dt><dd>{patient.complaint || 'Não informada.'}</dd></div><div><dt>História da doença atual</dt><dd>{patient.history || 'Não informada.'}</dd></div><div><dt>História médica</dt><dd>{patient.medicalHistory || 'Não informada.'}</dd></div><div><dt>História de hábitos e dependências</dt><dd>{patient.habitsHistory || 'Não informada.'}</dd></div><div><dt>História odontológica</dt><dd>{patient.dentalHistory || 'Não informada.'}</dd></div><div><dt>Exame extraoral</dt><dd>{patient.extraoralExam || 'Não informado.'}</dd></div><div><dt>Exame intraoral</dt><dd>{patient.intraoralExam || 'Não informado.'}</dd></div><div><dt>Hipóteses diagnósticas</dt><dd>{patient.hypotheses?.length ? <span className="hypothesis-list">{patient.hypotheses.map((item,index)=><span key={item}><i>{index+1}</i>{item}</span>)}</span> : <span className="muted-record">Nenhuma hipótese registrada.</span>}</dd></div></dl></section><aside className="panel case-details"><h2>Dados do caso</h2><dl><div><dt>Período acadêmico</dt><dd>{patient.semester}</dd></div><div><dt>Primeiro atendimento</dt><dd>{patient.firstVisit}</dd></div><div><dt>Aluno responsável</dt><dd>{patient.ownerName}<small>Matrícula {patient.ownerRegistration}</small></dd></div><div><dt>Professor supervisor</dt><dd>Não informado</dd></div><div><dt>Última atualização</dt><dd>{patient.lastVisit}</dd></div></dl><div className="audit"><ShieldCheck size={17}/>Histórico de alterações disponível</div></aside></div>
    <section className="panel final-diagnosis"><div className="panel-heading"><div><h2>Diagnóstico final</h2><p>Conclusão diagnóstica do caso</p></div>{patient.finalDiagnosis&&!editingDiagnosis&&<button className="text-button" onClick={()=>setEditingDiagnosis(true)}>Editar</button>}</div>{editingDiagnosis ? <form onSubmit={saveDiagnosis}><label>Diagnóstico final<input name="diagnosis" required defaultValue={patient.finalDiagnosis || ''} placeholder="Informe o diagnóstico final"/></label><label>Forma de confirmação<select name="confirmation" defaultValue={patient.diagnosisConfirmation || 'Clínica'}><option>Clínica</option><option>Anatomopatológica</option><option>Laboratorial</option><option>Outra</option></select></label><div><button type="button" className="ghost" onClick={()=>setEditingDiagnosis(false)}>Cancelar</button><button className="primary" type="submit">Salvar diagnóstico</button></div></form> : patient.finalDiagnosis ? <div className="diagnosis-result"><span><CheckCircle2 size={20}/></span><div><strong>{patient.finalDiagnosis}</strong><small>Confirmação {patient.diagnosisConfirmation?.toLowerCase()} · {patient.diagnosisDate}</small></div></div> : <div className="diagnosis-empty"><FlaskConical size={23}/><span><strong>Diagnóstico final ainda não registrado</strong><small>Adicione quando a investigação do caso estiver concluída.</small></span><button className="secondary" onClick={()=>setEditingDiagnosis(true)}><Plus size={16}/>Inserir diagnóstico</button></div>}</section>
    <div className="summary-media"><ClinicalGallery patient={patient}/><PatientFiles patient={patient}/></div>
  </>;
}

function EvolutionsView({ patient, onAdd }) {
  return <section className="timeline-section"><div className="section-heading"><div><h2>Evoluções clínicas</h2><p>Histórico longitudinal do paciente</p></div><button className="secondary" onClick={onAdd}><Plus size={17}/>Adicionar evolução</button></div><div className="timeline">{(patient.timeline || []).map(item=><article key={item.id}><div className="timeline-date"><strong>{item.date}</strong><span>{item.year}</span></div><i className="followup"/><div className="timeline-card"><div><strong>{item.title}</strong><span>por {item.author} · {item.time}</span></div><p>{item.text}</p>{item.procedures&&<div className="conduct"><span>PROCEDIMENTOS</span>{item.procedures}</div>}{item.action&&<div className="conduct"><span>CONDUTA</span>{item.action}</div>}{item.photos?.length>0&&<div className="evolution-photos">{item.photos.map((photo,index)=><img key={index} src={photo.url} alt={photo.name}/>)}</div>}{item.files?.length>0&&<div className="evolution-files">{item.files.map((file,index)=><span key={index}><Paperclip size={14}/>{file.name}</span>)}</div>}</div></article>)}{!(patient.timeline || []).length&&<div className="timeline-empty"><Clock3 size={24}/><strong>Nenhuma evolução registrada</strong><span>Adicione o primeiro retorno clínico, com fotos e arquivos quando necessário.</span></div>}</div></section>;
}

function ClinicalGallery({ patient }) {
  const [photos, setPhotos] = useState(patient.photos || []);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const addPhotos = event => setPhotos(current => [...current, ...Array.from(event.target.files).map(file => ({ name: file.name, url: URL.createObjectURL(file), date: 'Hoje', type: 'Fotografia clínica' }))]);
  return <section className="media-section"><div className="section-heading"><div><h2>Fotografias clínicas</h2><p>{photos.length} imagens vinculadas a este Guia Clínico</p></div><label className="secondary upload-button"><Upload size={17}/>Adicionar fotografias<input type="file" accept="image/jpeg,image/png,image/heic" multiple onChange={addPhotos}/></label></div>
    {photos.length ? <div className="photo-grid">{photos.map((photo,index)=><button key={`${photo.name}-${index}`} className="photo-card" onClick={()=>setSelectedPhoto(photo)}><img src={photo.url} alt={photo.name}/><span><strong>{photo.name}</strong><small>{photo.type} · {photo.date}</small></span><i><Eye size={16}/></i></button>)}</div> : <div className="panel empty-media"><Camera size={28}/><strong>Nenhuma fotografia adicionada</strong><span>Inclua registros clínicos para acompanhar a evolução do caso.</span></div>}
    {selectedPhoto && <div className="lightbox" onClick={()=>setSelectedPhoto(null)}><button><X size={22}/></button><img src={selectedPhoto.url} alt={selectedPhoto.name}/><div><strong>{selectedPhoto.name}</strong><span>{selectedPhoto.type} · {selectedPhoto.date}</span></div></div>}
  </section>;
}

function PatientFiles({ patient }) {
  const [files, setFiles] = useState(patient.files || []);
  const addFiles = event => setFiles(current => [...current, ...Array.from(event.target.files).map(file => ({ name: file.name, type: file.name.split('.').pop().toUpperCase(), size: `${Math.max(1, Math.round(file.size/1024))} KB`, date: 'Hoje' }))]);
  return <section className="media-section"><div className="section-heading"><div><h2>Arquivos do paciente</h2><p>Exames, laudos e documentos vinculados ao Guia Clínico</p></div><label className="secondary upload-button"><Paperclip size={17}/>Adicionar arquivos<input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={addFiles}/></label></div><div className="panel file-list">{files.map((file,index)=><div className="file-row" key={`${file.name}-${index}`}><span className="file-type"><FileText size={19}/></span><div><strong>{file.name}</strong><small>{file.type} · {file.size} · {file.date}</small></div><button className="icon-button" title="Baixar"><Download size={17}/></button></div>)}{!files.length&&<div className="empty-media"><FolderOpen size={28}/><strong>Nenhum arquivo adicionado</strong><span>Adicione exames, laudos ou documentos deste paciente.</span></div>}</div></section>;
}

function TabContent({ tab }) {
  const icons = {'Anamnese': FileText, 'Exame clínico': Stethoscope, 'Fotografias': Camera, 'Hipóteses': FlaskConical, 'Exames': FolderOpen, 'Biópsia': Activity, 'Evoluções': Clock3, 'Arquivos': Archive}; const Icon = icons[tab] || FileText;
  return <section className="panel placeholder-panel"><span><Icon size={26}/></span><h2>{tab}</h2><p>Esta seção está preparada para os registros clínicos do paciente.</p><button className="secondary"><Plus size={17}/>Adicionar registro</button></section>;
}

function EvolutionModal({ patient, user, onSave, close }) {
  const [saved, setSaved] = useState(false);
  const [photos, setPhotos] = useState([]); const [files, setFiles] = useState([]);
  const addPhotos = event => setPhotos(current=>[...current,...Array.from(event.target.files).map(file=>({name:file.name,url:URL.createObjectURL(file)}))]);
  const addFiles = event => setFiles(current=>[...current,...Array.from(event.target.files).map(file=>({name:file.name,size:file.size}))]);
  const submit = event => { event.preventDefault(); const form = new FormData(event.currentTarget); onSave({ id: Date.now(), title: `Evolução ${(patient.timeline || []).length + 1}`, date: '02 SET', displayDate: '02 set 2026', year: '2026', time: new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}), author: user.name, text: form.get('description'), procedures: form.get('procedures'), action: form.get('conduct'), photos, files }); setSaved(true); };
  return <div className="modal-layer" onMouseDown={e=>e.target===e.currentTarget&&close()}><div className="modal"><div className="modal-head"><div><p className="eyebrow">FICHA {patient.ficha}</p><h2>Nova evolução clínica</h2><span>{patient.name}</span></div><button className="icon-button" onClick={close}><X size={20}/></button></div>{saved ? <div className="success-state"><span><ShieldCheck size={30}/></span><h2>Evolução registrada</h2><p>Registro, fotos e arquivos foram incluídos em nome de {user.name}.</p><button className="primary" onClick={close}>Concluir</button></div> : <form onSubmit={submit}><div className="form-row"><label>Data do atendimento<input type="date" defaultValue="2026-09-02"/></label><label>Responsável<input value={user.name} disabled/></label></div><label>Descrição da evolução<textarea name="description" required placeholder="Descreva o estado atual, sintomas e alterações observadas..."/></label><div className="form-row"><label>Procedimentos realizados<textarea name="procedures" placeholder="Procedimentos realizados neste atendimento..."/></label><label>Conduta e planejamento<textarea name="conduct" placeholder="Conduta, orientações e próximos passos..."/></label></div><div className="evolution-upload-grid"><label className="upload-zone"><Camera size={21}/><strong>Adicionar fotos</strong><span>JPG, PNG ou HEIC</span><input type="file" accept="image/*,.heic" multiple onChange={addPhotos}/></label><label className="upload-zone"><Paperclip size={21}/><strong>Adicionar arquivos</strong><span>PDF, JPG ou PNG</span><input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={addFiles}/></label></div>{(photos.length>0||files.length>0)&&<div className="modal-file-summary">{photos.map((photo,index)=><span key={`p-${index}`}><Camera size={13}/>{photo.name}</span>)}{files.map((file,index)=><span key={`f-${index}`}><Paperclip size={13}/>{file.name}</span>)}</div>}<div className="modal-actions"><button type="button" className="ghost" onClick={close}>Cancelar</button><button type="submit" className="primary"><ShieldCheck size={17}/>Salvar evolução</button></div></form>}</div></div>;
}

function NewPatient({ onCreate, user, semester }) {
  const [saved, setSaved] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [files, setFiles] = useState([]);
  const [hypotheses, setHypotheses] = useState(['', '', '']);
  const [createdPatient, setCreatedPatient] = useState(null);
  const addPhotos = event => setPhotos([...photos, ...Array.from(event.target.files).map(file => ({ name: file.name, url: URL.createObjectURL(file), date: 'Hoje', type: 'Atendimento inicial' }))]);
  const addFiles = event => setFiles([...files, ...Array.from(event.target.files).map(file => ({ name: file.name, type: file.name.split('.').pop().toUpperCase(), size: `${Math.max(1, Math.round(file.size/1024))} KB`, date: 'Hoje' }))]);
  const submit = event => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const birth = new Date(form.get('birth')); const age = Math.max(0, 2026 - birth.getFullYear()); const name = form.get('name');
    const newPatient = { id: Date.now(), semester, ficha: form.get('record'), name, initials: name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase(), age, sex: form.get('sex'), ownerId: user.id, ownerName: user.name, ownerRegistration: user.registration, firstVisit: '02 set 2026', lastVisit: '02 set 2026', status: 'Em avaliação', accent: '#dcebe7', complaint: form.get('complaint'), history: form.get('history'), medicalHistory: form.get('medical'), habitsHistory: form.get('habits'), dentalHistory: form.get('dentalHistory'), extraoralExam: form.get('extraoralExam'), intraoralExam: form.get('intraoralExam'), hypotheses: hypotheses.filter(item=>item.trim()), photos, files, timeline: [], finalDiagnosis: '' };
    setCreatedPatient(newPatient); setSaved(true);
  };
  return <main className="page narrow-page"><div className="page-title"><div><p className="eyebrow">NOVO GUIA CLÍNICO · {semester}</p><h1>Cadastrar paciente</h1><p>Preencha os dados clínicos e adicione imagens e documentos.</p></div></div>{saved ? <div className="panel success-page"><span><ShieldCheck size={32}/></span><h2>Paciente cadastrado com sucesso</h2><p>O Guia Clínico foi registrado individualmente na conta de {user.name}.</p><button className="primary" onClick={()=>onCreate(createdPatient)}>Abrir Guia Clínico</button></div> : <form className="panel patient-form" onSubmit={submit}>
    <div className="form-section"><span>01</span><div><h2>Identificação</h2><p>Dados essenciais do paciente</p></div></div><div className="form-grid"><label>Número da ficha<input name="record" required placeholder="Ex.: 001270"/></label><label className="span-2">Nome completo<input name="name" required placeholder="Nome do paciente"/></label><label>Data de nascimento<input name="birth" required type="date"/></label><label>Sexo<select name="sex" required defaultValue=""><option value="" disabled>Selecione</option><option>Feminino</option><option>Masculino</option><option>Outro</option><option>Prefere não informar</option></select></label><label>Primeiro atendimento<input required type="date" defaultValue="2026-09-02"/></label></div><hr/>
    <div className="form-section"><span>02</span><div><h2>Atendimento inicial</h2><p>Registro clínico inicial</p></div></div><div className="form-grid"><label className="span-3">Queixa principal<textarea name="complaint" required placeholder="Registre preferencialmente com as palavras do paciente..."/></label><label className="span-3">História da doença atual<textarea name="history" placeholder="Início, duração, evolução, localização e sintomas..."/></label><label className="span-3">História médica<textarea name="medical" placeholder="Doenças sistêmicas, alergias, medicamentos e antecedentes relevantes..."/></label></div><hr/>
    <div className="form-section"><span>03</span><div><h2>Histórias complementares e exame clínico</h2><p>Hábitos, antecedentes odontológicos e achados do exame físico</p></div></div><div className="form-grid clinical-history-grid"><label>História de hábitos e dependências<textarea name="habits" placeholder="Tabagismo, consumo de álcool, outras substâncias, frequência e duração..."/></label><label>História odontológica<textarea name="dentalHistory" placeholder="Tratamentos anteriores, hábitos de higiene, uso de próteses e intercorrências..."/></label><label>Descrição do exame extraoral<textarea name="extraoralExam" placeholder="Face, simetria, pele, linfonodos, ATM e demais achados extraorais..."/></label><label>Descrição do exame intraoral<textarea name="intraoralExam" placeholder="Mucosas, língua, palato, assoalho, dentes, periodonto e demais achados..."/></label></div><hr/>
    <div className="form-section"><span>04</span><div><h2>Hipóteses diagnósticas</h2><p>Possibilidades consideradas no atendimento inicial</p></div></div><div className="hypothesis-fields">{hypotheses.map((value,index)=><label key={index}>Hipótese {index+1}<div><input required={index===0} value={value} onChange={event=>setHypotheses(hypotheses.map((item,i)=>i===index?event.target.value:item))} placeholder="Informe uma hipótese diagnóstica"/>{hypotheses.length>3&&<button type="button" onClick={()=>setHypotheses(hypotheses.filter((_,i)=>i!==index))}><X size={15}/></button>}</div></label>)}</div><button className="add-hypothesis" type="button" onClick={()=>setHypotheses([...hypotheses,''])}><Plus size={15}/>Adicionar outra hipótese</button><hr/>
    <div className="form-section"><span>05</span><div><h2>Fotos e arquivos</h2><p>Documentação do atendimento inicial</p></div></div><div className="patient-upload-grid"><label className="upload-zone"><Camera size={23}/><strong>Adicionar fotografias clínicas</strong><span>JPG, PNG ou HEIC · múltiplos arquivos</span><input type="file" accept="image/jpeg,image/png,image/heic" multiple onChange={addPhotos}/></label><label className="upload-zone"><Paperclip size={23}/><strong>Adicionar exames e documentos</strong><span>PDF, JPG ou PNG · múltiplos arquivos</span><input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={addFiles}/></label></div>
    {(photos.length > 0 || files.length > 0) && <div className="upload-preview">{photos.map((photo,index)=><div key={index} className="preview-image"><img src={photo.url} alt=""/><span>{photo.name}</span><button type="button" onClick={()=>setPhotos(photos.filter((_,i)=>i!==index))}><X size={14}/></button></div>)}{files.map((file,index)=><div key={index} className="preview-file"><FileText size={19}/><span>{file.name}</span><button type="button" onClick={()=>setFiles(files.filter((_,i)=>i!==index))}><X size={14}/></button></div>)}</div>}
    <div className="form-footer"><p><ShieldCheck size={16}/>Responsável individual: {user.name}</p><button className="primary" type="submit">Criar Guia Clínico <ChevronRight size={17}/></button></div></form>}</main>;
}

function UsersManagement({ accounts, onUpdate, onDelete }) {
  const students = accounts.filter(account=>account.role==='student'); const [editing, setEditing] = useState(null); const [query, setQuery] = useState('');
  const visible = students.filter(student=>`${student.name} ${student.email} ${student.registration}`.toLowerCase().includes(query.toLowerCase()));
  const save = event => { event.preventDefault(); const form = new FormData(event.currentTarget); onUpdate({...editing, name: form.get('name'), email: form.get('email'), registration: form.get('registration')}); setEditing(null); };
  return <main className="page"><div className="page-title"><div><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Cadastros de alunos</h1><p>Consulte, edite ou remova os acessos individuais dos alunos.</p></div></div><section className="panel users-panel"><div className="filters"><label className="search-field"><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar por nome, e-mail ou matrícula"/></label></div><div className="table-wrap"><table><thead><tr><th>ALUNO</th><th>MATRÍCULA</th><th>E-MAIL INSTITUCIONAL</th><th>PERFIL</th><th>AÇÕES</th></tr></thead><tbody>{visible.map(student=><tr key={student.id}><td><div className="table-person"><span className="profile-avatar student-avatar">{student.name.split(' ').slice(0,2).map(item=>item[0]).join('').toUpperCase()}</span><span><strong>{student.name}</strong><small>Acesso individual ativo</small></span></div></td><td className="mono">{student.registration}</td><td>{student.email}</td><td><span className="user-role"><GraduationCap size={14}/>Aluno</span></td><td><div className="row-actions"><button className="icon-button" title="Editar aluno" onClick={()=>setEditing(student)}><Pencil size={16}/></button><button className="icon-button danger-icon" title="Remover aluno" onClick={()=>{if(window.confirm(`Remover o cadastro de ${student.name}?`))onDelete(student.id)}}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table>{!visible.length&&<div className="empty"><Users size={28}/><strong>Nenhum aluno encontrado</strong><span>Os novos cadastros individuais aparecerão nesta lista.</span></div>}</div></section>
    {editing&&<div className="modal-layer" onMouseDown={event=>event.target===event.currentTarget&&setEditing(null)}><div className="modal compact-modal"><div className="modal-head"><div><p className="eyebrow">CADASTRO INDIVIDUAL</p><h2>Editar aluno</h2><span>Atualize os dados acadêmicos do acesso.</span></div><button className="icon-button" onClick={()=>setEditing(null)}><X size={20}/></button></div><form onSubmit={save}><label>Nome completo<input name="name" required defaultValue={editing.name}/></label><label>E-mail institucional<input name="email" type="email" required defaultValue={editing.email}/></label><label>Matrícula<input name="registration" required defaultValue={editing.registration}/></label><div className="modal-actions"><button type="button" className="ghost" onClick={()=>setEditing(null)}>Cancelar</button><button className="primary" type="submit"><ShieldCheck size={16}/>Salvar alterações</button></div></form></div></div>}
  </main>;
}

function GoogleDriveSettings() {
  const [connection, setConnection] = useState({ status: 'loading' });
  useEffect(() => {
    fetch('/api/google/status').then(response=>response.json()).then(setConnection).catch(()=>setConnection({ status: 'unavailable' }));
  }, []);
  const content = {
    loading: { title: 'Verificando conexão', text: 'Aguarde enquanto consultamos a configuração da Vercel.' },
    configuration_required: { title: 'Configuração necessária', text: 'Cadastre as credenciais OAuth nas variáveis privadas da Vercel e faça um novo deploy.' },
    authorization_required: { title: 'Autorizar sua conta Google', text: 'Conecte a conta proprietária do Meu Drive para permitir a criação das pastas do aplicativo.' },
    invalid_token: { title: 'Autorização expirada', text: 'O token armazenado não é mais válido. Autorize novamente a conta Google.' },
    unavailable: { title: 'Serviço indisponível', text: 'Não foi possível consultar a integração neste momento.' },
    connected: { title: 'Google Drive conectado', text: `Conta autorizada: ${connection.account?.emailAddress || connection.account?.displayName || 'Google Drive'}` },
  }[connection.status] || { title: 'Configuração do Google Drive', text: 'Verifique a integração.' };
  const canConnect = ['authorization_required','invalid_token'].includes(connection.status);
  return <main className="page narrow-page"><div className="page-title"><div><p className="eyebrow">INTEGRAÇÕES</p><h1>Google Drive</h1><p>Gerencie a conta usada para armazenar fotografias, exames e documentos.</p></div></div><section className={`panel drive-connection ${connection.status}`}><span className="drive-mark"><FolderOpen size={28}/></span><div><p className="eyebrow">ARMAZENAMENTO EXTERNO</p><h2>{content.title}</h2><p>{content.text}</p>{connection.status==='configuration_required'&&<small>Variáveis necessárias: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_STATE_SECRET e GOOGLE_REDIRECT_URI.</small>}{connection.status==='connected'&&<small>Escopo limitado aos arquivos criados pelo aplicativo.</small>}</div>{canConnect&&<a className="primary" href="/api/google/connect">Conectar Google Drive</a>}</section><div className="drive-warning"><ShieldCheck size={18}/><span><strong>Integração em preparação</strong><small>O envio de prontuários será habilitado somente após a implantação do banco e da autorização real dos usuários.</small></span></div></main>;
}

function PlaceholderPage({ title }) {
  return <main className="page"><div className="page-title"><div><p className="eyebrow">CLÍNICA-ESCOLA</p><h1>{title}</h1><p>Organização segura e longitudinal dos atendimentos.</p></div></div><section className="panel placeholder-panel"><span><Archive size={26}/></span><h2>{title}</h2><p>O módulo está pronto para receber os registros desta etapa.</p><button className="primary"><Plus size={17}/>Novo registro</button></section></main>;
}

export default function App() {
  const [accounts, setAccounts] = useState(demoAccounts); const [user, setUser] = useState(null); const [active, setActive] = useState('Visão geral'); const [selected, setSelected] = useState(null); const [mobileOpen, setMobileOpen] = useState(false); const [semester, setSemester] = useState(CURRENT_SEMESTER); const [patients, setPatients] = useState(()=>seedPatients.map(patient=>({...patient,semester:patient.semester||CURRENT_SEMESTER}))); const isAdmin = user?.role === 'admin';
  const semesters = useMemo(()=>[...new Set([CURRENT_SEMESTER,...patients.map(patient=>patient.semester)])].sort().reverse(),[patients]);
  if (!user) return <AuthPage accounts={accounts} onAuth={setUser} onRegister={account=>setAccounts(current=>[...current,account])}/>;
  const openPatient = p => setSelected(p); const navigate = label => { setSelected(null); setActive(label); };
  const createPatient = p => { setPatients(current => current.some(item=>item.id===p.id) ? current : [p,...current]); openPatient(p); };
  const updatePatient = updated => { setPatients(current=>current.map(item=>item.id===updated.id?updated:item)); setSelected(updated); };
  const deletePatient = id => { setPatients(current=>current.filter(item=>item.id!==id)); setSelected(null); setActive('Todos os casos'); };
  const updateAccount = updated => { setAccounts(current=>current.map(item=>item.id===updated.id?updated:item)); setPatients(current=>current.map(patient=>patient.ownerId===updated.id?{...patient,ownerName:updated.name,ownerRegistration:updated.registration}:patient)); };
  const deleteAccount = id => setAccounts(current=>current.filter(item=>item.id!==id));
  let content;
  if (selected) content = <PatientPage patient={selected} user={user} onUpdate={updatePatient} onDelete={deletePatient} goBack={()=>setSelected(null)}/>;
  else if (active === 'Visão geral') content = <Dashboard setActive={navigate} openPatient={openPatient} isAdmin={isAdmin} patients={patients} user={user} semester={semester}/>;
  else if (active === 'Meus casos' || active === 'Todos os casos') content = <CasesPage isAdmin={active === 'Todos os casos' || isAdmin && active === 'Todos os casos'} openPatient={openPatient} patients={patients} user={user} semester={semester} semesters={semesters} onSemesterChange={setSemester}/>;
  else if (active === 'Novo paciente') content = <NewPatient onCreate={createPatient} user={user} semester={semester}/>;
  else if (active === 'Usuários' && isAdmin) content = <UsersManagement accounts={accounts} onUpdate={updateAccount} onDelete={deleteAccount}/>;
  else if (active === 'Google Drive' && isAdmin) content = <GoogleDriveSettings/>;
  else content = <PlaceholderPage title={active}/>;
  return <div className="app-shell"><Sidebar active={active} setActive={navigate} isAdmin={isAdmin} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} user={user} onLogout={()=>{setUser(null);setSelected(null);setActive('Visão geral')}}/>{mobileOpen&&<div className="mobile-scrim" onClick={()=>setMobileOpen(false)}/>}<div className="main-shell"><Header setMobileOpen={setMobileOpen} isAdmin={isAdmin} semester={semester}/>{content}<footer><span>Clínica de Estomatologia · UFPB</span><span>Período {semester} · Sessão individual: {user.name} · Dados fictícios</span></footer></div></div>;
}
