import { useState, useEffect, useRef } from "react";
import { Search, MoreVertical, Forward, Tag, Send, Paperclip, Smile, LayoutList, LayoutGrid, Clock, AlertTriangle, X, FileText, Image as ImageIcon, Music, Play, File as FileIcon, Loader2, MessageSquareOff } from "lucide-react";
import { io, Socket } from "socket.io-client";

type Ticket = {
  id: number;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
  status: "pending" | "open" | "closed";
  slaStatus: "ok" | "warning" | "breached";
  profilePicUrl?: string;
};

type User = {
  id: number;
  name: string;
  nickname?: string;
  profile: string;
};

type MessageInfo = {
  id: number | string;
  senderName: string;
  text: string;
  time: string;
  isMe: boolean;
  type: "text" | "audio" | "pdf" | "image" | "file";
  fileUrl?: string;
  fileName?: string;
};

export function Chat() {
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [messageText, setMessageText] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<MessageInfo[]>([]);
  
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const selectedTicketRef = useRef<number | null>(selectedTicket);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    selectedTicketRef.current = selectedTicket;
  }, [selectedTicket]);

  useEffect(() => {
    const userStr = localStorage.getItem("user") || sessionStorage.getItem("user");
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }

    const fetchTickets = async () => {
      try {
        const res = await fetch("/api/tickets");
        const data = await res.json();
        setTickets(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingTickets(false);
      }
    };
    fetchTickets();

    const socket = io();
    socketRef.current = socket;

    socket.on("whatsapp:message", (data) => {
      fetchTickets(); // Refresh tickets
      if (selectedTicketRef.current && data.ticket && data.ticket.id === selectedTicketRef.current) {
        // If it's the current selected ticket, add the new message to state
        const newMsg: MessageInfo = {
          id: data.message.id,
          senderName: data.message.senderName,
          text: data.message.body,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMe: data.message.fromMe,
          type: data.message.mediaType || "text",
          fileUrl: data.message.mediaUrl,
          fileName: data.message.fileName
        };
        setMessages(prev => [...prev, newMsg]);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (selectedTicket) {
      setLoadingMessages(true);
      fetch(`/api/tickets/${selectedTicket}/messages`)
        .then(res => res.json())
        .then(data => setMessages(data))
        .catch(err => console.error(err))
        .finally(() => setLoadingMessages(false));
    }
  }, [selectedTicket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if (!selectedTicket) return;
    if (!messageText.trim() && attachments.length === 0) return;

    let finalMessage = messageText;
    if (currentUser?.nickname) {
      finalMessage = `*${currentUser.nickname}*: ${messageText}`;
    }
    const senderName = currentUser?.nickname || currentUser?.name || "Você";

    if (attachments.length > 0) {
      for (const file of attachments) {
        const formData = new FormData();
        formData.append("file", file);
        if (messageText) {
          formData.append("text", finalMessage);
        }

        try {
          const res = await fetch(`/api/tickets/${selectedTicket}/send`, {
            method: "POST",
            body: formData
          });
          const savedMsg = await res.json();
          if (savedMsg && savedMsg.id) {
             const newMsg: MessageInfo = {
               id: savedMsg.id,
               senderName: savedMsg.senderName,
               text: savedMsg.body,
               time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
               isMe: true,
               type: savedMsg.mediaType || "text",
               fileUrl: savedMsg.mediaUrl,
               fileName: savedMsg.fileName
             };
             setMessages(prev => [...prev, newMsg]);
          }
        } catch (err) {
          console.error("Error sending media message", err);
        }
      }
      setAttachments([]);
      setMessageText("");
    } else {
      setMessageText("");

      try {
        const res = await fetch(`/api/tickets/${selectedTicket}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: finalMessage })
        });
        const savedMsg = await res.json();
        if (savedMsg && savedMsg.id) {
           const newMsg: MessageInfo = {
             id: savedMsg.id,
             senderName: savedMsg.senderName,
             text: savedMsg.body,
             time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
             isMe: true,
             type: "text"
           };
           setMessages(prev => [...prev, newMsg]);
        }
      } catch (err) {
        console.error("Error sending message", err);
      }
    }
  };

  const renderSlaBadge = (slaStatus: string) => {
    switch (slaStatus) {
      case "ok":
        return <span className="flex items-center text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3 mr-1" /> No prazo</span>;
      case "warning":
        return <span className="flex items-center text-[10px] font-medium text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3 mr-1" /> Vencendo</span>;
      case "breached":
        return <span className="flex items-center text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3 mr-1" /> Atrasado</span>;
      default:
        return null;
    }
  };

  const columns = [
    { id: "pending", title: "Aguardando" },
    { id: "open", title: "Em Atendimento" }
  ];

  return (
    <div className="flex-1 flex overflow-hidden font-sans bg-slate-50">
      {viewMode === "list" ? (
        <>
          {/* Sidebar de Chats */}
          <section className="w-full md:w-[320px] bg-white border-r border-slate-200 flex flex-col shrink-0">
            <header className="p-4 border-b border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-slate-900">Conversas</h1>
                <button 
                  onClick={() => setViewMode("kanban")}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                  title="Mudar para visualização Kanban"
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  className="w-full bg-slate-100 border-none rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-green-500 outline-none text-slate-900 placeholder-slate-500"
                  placeholder="Pesquisar conversas..."
                />
              </div>
            </header>
            
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col">
                {loadingTickets ? (
                  <div className="p-6 flex flex-col items-center justify-center space-y-3 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                    <span className="text-sm">Carregando conversas...</span>
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-sm">
                    Nenhuma conversa encontrada.
                  </div>
                ) : (
                  tickets.map((ticket) => {
                    const isActive = selectedTicket === ticket.id;
                    return (
                      <div
                        key={ticket.id}
                        onClick={() => setSelectedTicket(ticket.id)}
                        className={`flex p-4 cursor-pointer border-l-4 border-b border-slate-100 transition-colors ${
                          isActive ? "bg-green-50 border-green-500" : "hover:bg-slate-50 border-l-transparent"
                        }`}
                      >
                        <div className="mr-3 relative shrink-0">
                          <img 
                            src={ticket.profilePicUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(ticket.name)}&background=random`} 
                            alt={ticket.name} 
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="font-semibold text-slate-900 truncate">{ticket.name}</h3>
                            <span className="text-[10px] text-slate-500 shrink-0 ml-2">{ticket.time}</span>
                          </div>
                          <div className="flex items-center space-x-2 mb-1">
                            {renderSlaBadge(ticket.slaStatus)}
                          </div>
                          <div className="flex justify-between items-center mt-auto">
                            <p className="text-xs text-slate-600 truncate mr-2">{ticket.lastMessage}</p>
                            {ticket.unread > 0 && (
                              <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-green-500 rounded-full shrink-0">
                                {ticket.unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          {/* Área de Mensagens */}
          <main className={`${selectedTicket ? 'flex' : 'hidden'} md:flex flex-1 flex-col bg-[#efeae2]`}>
            {selectedTicket ? (
              <>
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shrink-0 shadow-sm z-10">
                  <div className="flex items-center space-x-3">
                    <img 
                      src={tickets.find((t) => t.id === selectedTicket)?.profilePicUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(tickets.find((t) => t.id === selectedTicket)?.name || '')}&background=random`}
                      alt="Profile" 
                      className="w-10 h-10 rounded-full object-cover shadow-sm"
                    />
                    <h2 className="font-bold text-slate-800 leading-none">
                      {tickets.find((t) => t.id === selectedTicket)?.name}
                    </h2>
                  </div>
                  <div className="flex items-center space-x-1 md:space-x-2">
                    <button className="flex items-center space-x-1 px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                      <Forward className="h-4 w-4" />
                      <span className="hidden md:inline">Encaminhar</span>
                    </button>
                    <button className="flex items-center space-x-1 px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                      <Tag className="h-4 w-4" />
                      <span className="hidden md:inline">Tags</span>
                    </button>
                    <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors ml-1 md:ml-2">
                      <MoreVertical className="h-5 w-5" />
                    </button>
                  </div>
                </header>
                
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
                      <MessageSquareOff className="w-10 h-10 text-slate-300" />
                      <p className="text-sm">Nenhuma mensagem nesta conversa.</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`p-2.5 md:p-3 rounded-lg shadow-sm max-w-[85%] md:max-w-[70%] relative ${msg.isMe ? "bg-[#dcf8c6] rounded-tr-none" : "bg-white rounded-tl-none"}`}>
                          {!msg.isMe && (
                            <span className="text-xs font-bold text-slate-600 block mb-1">{msg.senderName}</span>
                          )}
                          
                          {msg.type === "text" && (
                            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                          )}
                          {msg.type === "image" && (
                            <div className="flex flex-col mb-1">
                              <img src={msg.fileUrl} alt="Received" className="max-w-full rounded-lg mb-2 object-contain bg-black/5" />
                              {msg.text && <p className="text-sm text-slate-800 mt-1">{msg.text}</p>}
                            </div>
                          )}
                          {msg.type === "audio" && (
                            <div className="flex flex-col mb-1 min-w-[200px]">
                              <audio controls src={msg.fileUrl} className="w-full h-10 mb-2" />
                              {msg.text && <p className="text-sm text-slate-800 mt-1">{msg.text}</p>}
                            </div>
                          )}
                          {msg.type === "pdf" && (
                            <div className="flex flex-col mb-1 min-w-[200px]">
                              <div className="flex items-center space-x-3 bg-white/50 p-3 rounded-lg border border-slate-200/50 mb-2 hover:bg-white transition-colors cursor-pointer" onClick={() => window.open(msg.fileUrl, '_blank')}>
                                <FileText className="w-8 h-8 text-red-500 shrink-0" />
                                <span className="text-sm font-medium text-slate-800 truncate" title={msg.fileName}>{msg.fileName}</span>
                              </div>
                              {msg.text && <p className="text-sm text-slate-800 mt-2">{msg.text}</p>}
                            </div>
                          )}
                          {msg.type === "file" && (
                            <div className="flex flex-col mb-1 min-w-[200px]">
                              <div className="flex items-center space-x-3 bg-white/50 p-3 rounded-lg border border-slate-200/50 mb-2 hover:bg-white transition-colors cursor-pointer" onClick={() => window.open(msg.fileUrl, '_blank')}>
                                <FileIcon className="w-8 h-8 text-slate-500 shrink-0" />
                                <span className="text-sm font-medium text-slate-800 truncate" title={msg.fileName}>{msg.fileName}</span>
                              </div>
                              {msg.text && <p className="text-sm text-slate-800 mt-2">{msg.text}</p>}
                            </div>
                          )}
                          
                          <div className="flex items-center justify-end mt-1 space-x-1">
                            <span className="text-[10px] text-slate-400">{msg.time}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="bg-[#f0f2f5] md:bg-white flex flex-col p-2 md:p-0 border-t md:border-t-0 border-slate-200">
                  {attachments.length > 0 && (
                    <div className="px-4 pt-2 md:pt-4 flex flex-wrap gap-2 md:border-t border-slate-200 bg-white md:bg-transparent rounded-t-xl md:rounded-none">
                      {attachments.map((file, idx) => (
                        <div key={idx} className="relative flex items-center p-2 bg-slate-100 rounded-lg border border-slate-200 pr-8 max-w-[200px]">
                          {file.type.startsWith('image/') ? <ImageIcon className="w-4 h-4 mr-2 text-slate-500 shrink-0" /> :
                            file.type === 'application/pdf' ? <FileText className="w-4 h-4 mr-2 text-red-500 shrink-0" /> :
                           file.type.startsWith('audio/') ? <Music className="w-4 h-4 mr-2 text-blue-500 shrink-0" /> :
                           <FileIcon className="w-4 h-4 mr-2 text-slate-500 shrink-0" />}
                          <span className="text-xs text-slate-700 truncate">{file.name}</span>
                          <button onClick={() => removeAttachment(idx)} className="absolute right-2 text-slate-400 hover:text-red-500">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <footer className={`p-2 md:p-4 bg-[#f0f2f5] md:bg-white ${attachments.length === 0 ? 'md:border-t border-slate-200' : ''}`}>
                    <div className="flex items-center space-x-2">
                      <button className="p-2 text-slate-500 hover:text-slate-700 md:text-slate-400 md:hover:text-slate-600">
                        <Smile className="h-6 w-6 md:h-5 md:w-5" />
                      </button>
                      <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-500 hover:text-slate-700 md:text-slate-400 md:hover:text-slate-600">
                        <Paperclip className="h-6 w-6 md:h-5 md:w-5" />
                      </button>
                      <input 
                        type="file" 
                        multiple 
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept="image/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx" 
                      />
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                          className="w-full bg-white md:bg-slate-50 border border-slate-300 md:border-slate-200 rounded-xl py-2.5 md:py-2 px-4 text-sm focus:ring-1 focus:ring-green-500 focus:outline-none text-slate-900 placeholder-slate-500"
                          placeholder="Mensagem"
                        />
                      </div>
                      <button onClick={handleSendMessage} className="bg-green-500 text-white p-2.5 md:p-2.5 rounded-full hover:bg-green-600 shadow-sm flex items-center justify-center shrink-0">
                        <Send className="h-5 w-5 md:h-4 md:w-4" />
                      </button>
                    </div>
                  </footer>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] md:bg-slate-50">
                <div className="bg-white/50 p-8 rounded-2xl flex flex-col items-center">
                  <MessageSquareOff className="w-16 h-16 text-slate-300 mb-4" />
                  <h3 className="text-xl font-medium text-slate-700 mb-2">WhatsApp Web</h3>
                  <p className="text-slate-500 text-sm text-center max-w-sm">
                    Selecione uma conversa na lista lateral ou pesquise para iniciar o atendimento.
                  </p>
                </div>
              </div>
            )}
          </main>
        </>
      ) : (
        /* Kanban View */
        <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden bg-slate-50">
          <header className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Kanban de Atendimentos</h1>
            <button 
              onClick={() => setViewMode("list")}
              className="flex items-center px-3 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm"
            >
              <LayoutList className="w-4 h-4 mr-2" />
              Ver como Lista
            </button>
          </header>
          
          <div className="flex-1 overflow-x-auto flex space-x-6 pb-4">
            {loadingTickets ? (
              <div className="flex w-full items-center justify-center space-x-3 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Carregando kanban...</span>
              </div>
            ) : (
              columns.map(col => (
                <div key={col.id} className="w-80 flex-shrink-0 flex flex-col bg-slate-100 rounded-xl">
                  <div className="p-3 bg-slate-200/50 rounded-t-xl border-b border-slate-200">
                    <h3 className="font-semibold text-slate-800 flex items-center justify-between">
                      {col.title}
                      <span className="bg-slate-300 text-slate-700 text-xs px-2 py-0.5 rounded-full">
                        {tickets.filter(t => t.status === col.id).length}
                      </span>
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {tickets.filter(t => t.status === col.id).map(ticket => (
                      <div 
                        key={ticket.id} 
                        onClick={() => { setSelectedTicket(ticket.id); setViewMode("list"); }}
                        className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 cursor-pointer hover:border-green-400 hover:shadow-md transition-all flex flex-col"
                      >
                        <div className="flex items-center space-x-3 mb-2">
                          <img 
                            src={ticket.profilePicUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(ticket.name)}&background=random`} 
                            alt={ticket.name} 
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                          />
                          <div className="flex-1 min-w-0 flex justify-between items-start">
                            <h4 className="font-semibold text-slate-900 text-sm truncate pr-2">{ticket.name}</h4>
                            {ticket.unread > 0 && (
                              <span className="bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                                {ticket.unread}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mb-3">
                          {renderSlaBadge(ticket.slaStatus)}
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2">{ticket.lastMessage}</p>
                        <div className="mt-3 text-[10px] text-slate-400 text-right">
                          Última interação: {ticket.time}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
