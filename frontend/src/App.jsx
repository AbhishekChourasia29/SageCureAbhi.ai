import React, { useState, useEffect, useRef } from 'react';

// --- Configuration ---
const API_URL = 'http://127.0.0.1:8000'; // Your FastAPI backend URL

// --- Style Definitions (CSS-in-JS) ---
const colors = {
    primary: '#10b981', 
    primaryHover: '#059669',
    primaryDisabled: '#6ee7b7',
    lightGray: '#f3f4f6', 
    mediumGray: '#e5e7eb',
    darkGray: '#4b5563',
    textPrimary: '#1f2937',
    white: '#ffffff',
    danger: '#ef4444',
    dangerHover: '#dc2626',
    prescriptionBg: '#e0f2fe',
    prescriptionBorder: '#7dd3fc',
};

const styles = {
    appContainer: { backgroundColor: colors.lightGray, minHeight: '100vh', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column' },
    header: { backgroundColor: colors.white, padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' },
    logoContainer: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
    headerTitle: { fontSize: '1.5rem', fontWeight: 'bold', color: colors.textPrimary },
    nav: { display: 'flex', alignItems: 'center', gap: '1rem' },
    navButton: { padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: '500', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s' },
    mainContent: { flexGrow: 1, padding: '1rem 2rem 2rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    contentWrapper: { width: '100%', maxWidth: '56rem', height: '100%' },
    card: { backgroundColor: colors.white, padding: '2rem', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' },
    button: { display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', padding: '0.5rem 1rem', border: 'none', borderRadius: '0.375rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', fontSize: '0.875rem', fontWeight: '500', color: colors.white, backgroundColor: colors.primary, cursor: 'pointer', transition: 'background-color 0.2s' },
    input: { marginTop: '0.25rem', display: 'block', width: '100%', padding: '0.5rem 0.75rem', backgroundColor: colors.white, color: colors.textPrimary, border: '1px solid #d1d5db', borderRadius: '0.375rem', boxSizing: 'border-box' },
    chatContainer: { display: 'flex', flexDirection: 'column', height: '80vh' },
    messagesContainer: { flexGrow: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column' },
    messageBubbleUser: { maxWidth: '80%', padding: '0.5rem 1rem', borderRadius: '0.75rem', backgroundColor: colors.primary, color: colors.white, alignSelf: 'flex-end', marginBottom: '1rem' },
    messageBubbleBot: { maxWidth: '80%', padding: '0.5rem 1rem', borderRadius: '0.75rem', backgroundColor: colors.mediumGray, color: colors.textPrimary, alignSelf: 'flex-start', marginBottom: '1rem' },
    chatForm: { padding: '1rem', borderTop: `1px solid ${colors.mediumGray}`, display: 'flex', gap: '0.5rem' },
    promptContainer: { padding: '0.5rem 1rem 1rem 1rem', borderTop: `1px solid ${colors.mediumGray}`, display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' },
    promptButton: { padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: colors.darkGray, backgroundColor: colors.white, border: `1px solid ${colors.mediumGray}`, borderRadius: '9999px', cursor: 'pointer', transition: 'background-color 0.2s' },
    deleteButton: { background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', borderRadius: '50%' },
};

const useHover = () => {
    const [hovered, setHovered] = useState(false);
    const eventHandlers = { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) };
    return [hovered, eventHandlers];
};

function App() {
    const [userId, setUserId] = useState(null);
    const [page, setPage] = useState('chat');
    const [jsPDF, setJsPDF] = useState(null);
    const [sessionKey, setSessionKey] = useState(0);

    useEffect(() => {
        let sessionUserId = localStorage.getItem('sageCureAbhiUserId');
        if (!sessionUserId) {
            sessionUserId = crypto.randomUUID();
            localStorage.setItem('sageCureAbhiUserId', sessionUserId);
        }
        setUserId(sessionUserId);
        if (window.jspdf) {
            setJsPDF(() => window.jspdf.jsPDF);
        }
    }, []);
    
    const handleNewSession = async () => {
        if (!userId || !window.confirm("Are you sure you want to delete this entire conversation and start a new session?")) {
            return;
        }
        try {
            const response = await fetch(`${API_URL}/history/clear`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId }),
            });
            if (response.ok) {
                setSessionKey(prevKey => prevKey + 1);
                setPage('chat');
            } else {
                alert("Could not start a new session. Please try again.");
            }
        } catch (error) {
            console.error("Failed to start new session:", error);
            alert("An error occurred while starting a new session.");
        }
    };

    const [chatHover, chatHandlers] = useHover();
    const [dashHover, dashHandlers] = useHover();
    const [newSessionHover, newSessionHandlers] = useHover();

    const renderPage = () => {
        if (!userId) return <div style={styles.card}><p>Initializing session...</p></div>;
        switch (page) {
            case 'chat': return <ChatPage key={sessionKey} userId={userId} jsPDF={jsPDF} />;
            case 'dashboard': return <DashboardPage key={sessionKey} userId={userId} jsPDF={jsPDF} />;
            default: return <ChatPage key={sessionKey} userId={userId} jsPDF={jsPDF} />;
        }
    };
    
    return (
        <div style={styles.appContainer}>
            <header style={styles.header}>
                <div style={styles.logoContainer}>
                     <svg xmlns="http://www.w3.org/2000/svg" style={{height: '2rem', width: '2rem', color: colors.primary}} viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                    <h1 style={styles.headerTitle}>SageCureAbhi</h1>
                </div>
                <nav style={styles.nav}>
                    <button onClick={() => setPage('chat')} style={{ ...styles.navButton, backgroundColor: page === 'chat' ? '#d1fae5' : (chatHover ? colors.mediumGray : colors.white), color: page === 'chat' ? '#065f46' : colors.darkGray }} {...chatHandlers}>Chat</button>
                    <button onClick={() => setPage('dashboard')} style={{ ...styles.navButton, backgroundColor: page === 'dashboard' ? '#d1fae5' : (dashHover ? colors.mediumGray : colors.white), color: page === 'dashboard' ? '#065f46' : colors.darkGray }} {...dashHandlers}>Dashboard</button>
                    <button onClick={handleNewSession} style={{ ...styles.navButton, backgroundColor: newSessionHover ? colors.dangerHover : colors.danger, color: colors.white }} {...newSessionHandlers}>New Session</button>
                </nav>
            </header>
            <main style={styles.mainContent}>
                <div style={styles.contentWrapper}>{renderPage()}</div>
            </main>
        </div>
    );
}

function ChatPage({ userId, jsPDF }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);
    const [sendBtnHover, sendBtnHandlers] = useHover();

    const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }) };

    useEffect(scrollToBottom, [messages]);
    
    useEffect(() => {
        const fetchHistory = async () => {
            if (!userId) return;
            try {
                const response = await fetch(`${API_URL}/history`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) });
                if (response.ok) setMessages(await response.json());
            } catch (error) {
                console.error("Failed to fetch history:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [userId]);

    const sendMessage = async (messageText) => {
        if (!messageText.trim() || !userId) return;
        
        const userMessage = { role: 'user', content: messageText, timestamp: new Date().toISOString(), prescription: null };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);
        
        try {
            const response = await fetch(`${API_URL}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, message: messageText }) });
            if (!response.ok) throw new Error('Failed to get response.');
            const { bot_message } = await response.json();
            setMessages(prev => [...prev, bot_message]);
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { role: 'bot', content: 'Sorry, I couldn\'t connect. Please try again.', timestamp: new Date().toISOString(), prescription: null }]);
        } finally {
            setLoading(false);
        }
    };
    
    const handleSend = (e) => { e.preventDefault(); sendMessage(input); };
    const handlePromptClick = (prompt) => { setInput(prompt); sendMessage(prompt); };

    return (
        <div style={{...styles.card, ...styles.chatContainer, padding: 0}}>
            <div style={styles.messagesContainer}>
                {messages.map((msg) => (
                    <React.Fragment key={msg.timestamp}>
                        <div style={msg.role === 'user' ? styles.messageBubbleUser : styles.messageBubbleBot}><p>{msg.content}</p></div>
                        {msg.prescription && <PrescriptionCard prescription={msg.prescription} jsPDF={jsPDF} />}
                    </React.Fragment>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div style={styles.promptContainer}>
                <button style={styles.promptButton} onClick={() => handlePromptClick("I have a runny nose and a sore throat.")}>"I have a runny nose..."</button>
                <button style={styles.promptButton} onClick={() => handlePromptClick("Recommend a pediatrician in Indore")}>"Recommend a pediatrician in Indore"</button>
                <button style={styles.promptButton} onClick={() => handlePromptClick("I have a stomach ache.")}>"I have a stomach ache"</button>
            </div>
             <div style={styles.chatForm}>
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe your symptoms..." style={{...styles.input, flexGrow: 1, borderRadius: '9999px', backgroundColor: loading ? colors.lightGray : colors.white}} disabled={loading} onKeyPress={(e) => e.key === 'Enter' && !loading && handleSend(e)} />
                <button onClick={handleSend} disabled={loading || !input.trim()} style={{...styles.button, width: 'auto', borderRadius: '9999px', padding: '0.5rem', backgroundColor: (loading || !input.trim()) ? colors.primaryDisabled : (sendBtnHover ? colors.primaryHover : colors.primary)}} {...sendBtnHandlers}>
                     <svg xmlns="http://www.w3.org/2000/svg" style={{height: '1.5rem', width: '1.5rem'}} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
            </div>
        </div>
    );
}

function DashboardPage({ userId, jsPDF }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exportHover, exportHandlers] = useHover();
    
    useEffect(() => {
        const fetchHistory = async () => {
            if (!userId) return;
            try {
                const response = await fetch(`${API_URL}/history`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) });
                if (response.ok) setHistory(await response.json());
            } catch (error) {
                console.error("Failed to fetch history:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [userId]);
    
    const handleExportPDF = () => {
        if (!jsPDF) {
            alert("PDF library is not loaded yet. Please try again in a moment.");
            return;
        }
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("SageCureAbhi Health Log", 14, 22);
        let y = 30;
        history.slice(1).forEach(msg => {
            if (y > 280) { doc.addPage(); y = 20; }
            const role = msg.role === 'user' ? 'You' : 'Dr. SageCureAbhi';
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`${role} (${new Date(msg.timestamp).toLocaleString()})`, 14, y);
            y += 5;
            doc.setFontSize(12);
            doc.setTextColor(0);
            const splitText = doc.splitTextToSize(msg.content, 180);
            doc.text(splitText, 14, y);
            y += (splitText.length * 5) + 5;
        });
        doc.save("sagecureabhi_log.pdf");
    };

    const handleDeleteItem = async (timestampToDelete) => {
        if (!userId) return;
        try {
            const response = await fetch(`${API_URL}/history/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, timestamp: timestampToDelete }),
            });
            if (response.ok) {
                const updatedHistory = await response.json();
                setHistory(updatedHistory);
            } else { alert("Could not delete the message."); }
        } catch (error) { alert("An error occurred while deleting."); }
    };

    if (loading) return <div style={styles.card}><p>Loading history...</p></div>;

    return (
        <div style={{...styles.card, height: '80vh', display: 'flex', flexDirection: 'column'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                 <h2 style={{fontSize: '1.5rem', fontWeight: 'bold', color: colors.textPrimary}}>Health Dashboard</h2>
                 <button onClick={handleExportPDF} style={{...styles.button, width: 'auto', backgroundColor: exportHover ? colors.primaryHover : colors.primary}} {...exportHandlers}>Export as PDF</button>
            </div>
            <div style={{flexGrow: 1, overflowY: 'auto', borderTop: `1px solid ${colors.mediumGray}`, paddingTop: '1rem'}}>
                 {history.length <= 1 ? (<p>No history found. Start a conversation in the chat tab!</p>) : (
                    <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                        {history.slice(1).map((msg) => (
                            <HistoryItem key={msg.timestamp} msg={msg} onDelete={() => handleDeleteItem(msg.timestamp)} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function HistoryItem({ msg, onDelete }) {
    const [deleteHover, deleteHandlers] = useHover();
    return (
        <div style={{padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: colors.lightGray, border: `1px solid ${colors.mediumGray}`}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem'}}>
                <p style={{fontWeight: 'bold', color: msg.role === 'user' ? colors.primary : '#3b82f6'}}>{msg.role === 'user' ? 'You' : 'Dr. SageCureAbhi'}</p>
                <button onClick={onDelete} style={{...styles.deleteButton, backgroundColor: deleteHover ? colors.mediumGray : 'transparent'}} {...deleteHandlers} aria-label="Delete message">
                    <svg style={{height: '1.25rem', width: '1.25rem', color: deleteHover ? colors.dangerHover : colors.danger}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
            <p style={{color: colors.textPrimary, whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>{msg.content}</p>
            {msg.prescription && <p style={{fontSize: '0.875rem', color: colors.darkGray, marginTop: '0.5rem', fontStyle: 'italic'}}>(Prescription generated)</p>}
            <p style={{fontSize: '0.75rem', color: colors.darkGray, marginTop: '0.25rem'}}>{new Date(msg.timestamp).toLocaleString()}</p>
        </div>
    );
}

function PrescriptionCard({ prescription, jsPDF }) {
    const [downloadHover, downloadHandlers] = useHover();
    const handleDownload = () => {
        if (!jsPDF) { alert("PDF library is not loaded."); return; }
        const doc = new jsPDF();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.text("Prescription - Dr. SageCureAbhi", 105, 20, null, null, "center");
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 35);
        
        doc.setLineWidth(0.5);
        doc.line(14, 40, 196, 40);

        let y = 50;
        const addField = (label, value) => {
            doc.setFont("helvetica", "bold");
            doc.text(`${label}:`, 14, y);
            doc.setFont("helvetica", "normal");
            const textLines = doc.splitTextToSize(value, 140);
            doc.text(textLines, 55, y);
            y += (textLines.length * 5) + 5;
        };

        addField("Diagnosis", prescription.disease);
        addField("Reported Symptoms", prescription.symptoms);
        addField("Symptom Duration", prescription.duration);

        y += 5;
        doc.setFont("helvetica", "bold");
        doc.text("Medications (Rx):", 14, y);
        y += 7;
        doc.setFont("helvetica", "normal");
        prescription.medications.forEach(med => {
            doc.text(`- ${med}`, 20, y);
            y += 7;
        });

        y += 5;
        addField("General Advice", prescription.advice);

        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text("Disclaimer: This is a preliminary AI-generated consultation and not a substitute for professional medical advice.", 105, 280, null, null, "center");

        doc.save(`Prescription_${prescription.disease.replace(/\s/g, '_')}.pdf`);
    };

    return (
        <div style={{ alignSelf: 'flex-start', width: '80%', padding: '1rem', marginBottom: '1rem', backgroundColor: colors.prescriptionBg, border: `1px solid ${colors.prescriptionBorder}`, borderRadius: '0.75rem'}}>
            <h3 style={{fontWeight: 'bold', color: colors.textPrimary, fontSize: '1.125rem', borderBottom: `1px solid ${colors.prescriptionBorder}`, paddingBottom: '0.5rem', marginBottom: '0.75rem'}}>Preliminary Prescription</h3>
            <div style={{fontSize: '0.875rem'}}>
                <p><strong>Diagnosis:</strong> {prescription.disease}</p>
                <p><strong>Symptoms:</strong> {prescription.symptoms}</p>
                <p><strong>Duration:</strong> {prescription.duration}</p>
                <p style={{marginTop: '0.5rem'}}><strong>Medications:</strong></p>
                <ul style={{listStyleType: 'disc', paddingLeft: '1.25rem'}}>
                    {prescription.medications.map((med, i) => <li key={i}>{med}</li>)}
                </ul>
                <p style={{marginTop: '0.5rem'}}><strong>Advice:</strong> {prescription.advice}</p>
            </div>
            <button onClick={handleDownload} style={{...styles.button, width: 'auto', marginTop: '1rem', backgroundColor: downloadHover ? colors.primaryHover : colors.primary}} {...downloadHandlers}>
                <svg style={{height: '1rem', width: '1rem'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                <span>Download as PDF</span>
            </button>
        </div>
    );
}

export default App;

