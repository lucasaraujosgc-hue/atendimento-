import { useState, useEffect, useRef } from "react";
import { Search, MoreVertical, Forward, Tag, Send, Paperclip, Smile, LayoutList, LayoutGrid, Clock, AlertTriangle, X, FileText, Image as ImageIcon, Music, Play, File as FileIcon } from "lucide-react";
import { io } from "socket.io-client";

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
  
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      }
    };
    fetchTickets();

    const socket = io();
    socket.on("whatsapp:message", (data) => {
      fetchTickets(); // Refresh tickets
      if (selectedTicket && data.ticket && data.ticket.id === selectedTicket) {
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
  }, [selectedTicket]);

  useEffect(() => {
    if (selectedTicket) {
      fetch(`/api/tickets/${selectedTicket}/messages`)
        .then(res => res.json())
        .then(data => setMessages(data))
        .catch(err => console.error(err));
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

    // Optimistic UI updates
    const newMessages: MessageInfo[] = [];

    if (attachments.length > 0) {
      attachments.forEach((file, index) => {
        const url = URL.createObjectURL(file);
        let type: "text" | "audio" | "pdf" | "image" | "file" = "file";
        
        if (file.type.startsWith("image/")) type = "image";
        else if (file.type.startsWith("audio/")) type = "audio";
        else if (file.type === "application/pdf") type = "pdf";

        newMessages.push({
          id: Date.now() + index,
          senderName: senderName,
          text: index === attachments.length - 1 ? finalMessage : "",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMe: true,
          type,
          fileUrl: url,
          fileName: file.name
        });
      });
    } else {
      newMessages.push({
        id: Date.now(),
        senderName: senderName,
        text: finalMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: true,
        type: "text"
      });
    }

    setMessages(prev => [...prev, ...newMessages]);
    const previousText = messageText;
    setMessageText("");
    const filesToSend = [...attachments];
    setAttachments([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    
    // API Call
    try {
      const formData = new FormData();
      formData.append("text", finalMessage);
      formData.append("senderName", senderName);
      filesToSend.forEach(file => {
        formData.append("files", file);
      });

      const res = await fetch(`/api/tickets/${selectedTicket}/send`, {
        method: "POST",
        body: formData
      });
      if (!res.ok) {
        throw new Error("Falha ao enviar mensagem");
      }
      
      // Update ticket list lastMessage
      setTickets(prev => prev.map(t => t.id === selectedTicket ? { ...t, lastMessage: finalMessage, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } : t));
    } catch (err) {
      console.error(err);
      // Revert if error?
    }
  };

  const columns = [
    { id: "pending", title: "Aguardando" },
    { id: "open", title: "Em Atendimento" },
    { id: "closed", title: "Resolvidos" },
  ];

  const renderSlaBadge = (slaStatus: string) => {
    switch (slaStatus) {
      case "warning":
        return <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold bg-yellow-100 text-yellow-700 rounded"><Clock className="w-3 h-3 mr-1" /> SLA Perto</span>;
      case "breached":
        return <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 rounded"><AlertTriangle className="w-3 h-3 mr-1" /> SLA Violado</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden font-sans bg-slate-50">
      {viewMode === "list" ? (
        <>
          {/* Sidebar de Chats */}
          <section className="w-[320px] bg-white border-r border-slate-200 flex flex-col">
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
                {tickets.map((ticket) => {
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
                })}
              </div>
            </div>
          </section>

          {/* Área de Mensagens */}
          <main className="flex-1 flex flex-col bg-[#efeae2]">
            {selectedTicket ? (
              <>
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
                  <div className="flex items-center space-x-3">
                    <img 
                      src={tickets.find((t) => t.id === selectedTicket)?.profilePicUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(tickets.find((t) => t.id === selectedTicket)?.name || '')}&background=random`}
                      alt="Profile" 
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <h2 className="font-bold text-slate-800 leading-none">
                      {tickets.find((t) => t.id === selectedTicket)?.name}
                    </h2>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                      <Forward className="h-4 w-4" />
                      <span>Encaminhar</span>
                    </button>
                    <button className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                      <Tag className="h-4 w-4" />
                      <span>Tags</span>
                    </button>
                    <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors ml-2">
                      <MoreVertical className="h-5 w-5" />
                    </button>
                  </div>
                </header>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`p-3 rounded-lg shadow-sm max-w-[70%] relative ${msg.isMe ? "bg-[#dcf8c6] rounded-tr-none" : "bg-white rounded-tl-none"}`}>
                        {!msg.isMe && <span className="text-[10px] font-bold text-blue-600 block mb-1">{msg.senderName}</span>}
                        {msg.isMe && <span className="text-[10px] font-bold text-green-700 block mb-1">{msg.senderName}</span>}
                        
                        {msg.type === "text" && <p className="text-sm text-slate-800">{msg.text}</p>}
                        
                        {msg.type === "audio" && (
                          <div className="flex flex-col mb-1">
                            <audio controls src={msg.fileUrl} className="w-full h-10 max-w-[240px] outline-none" />
                            {msg.text && <p className="text-sm text-slate-800 mt-2">{msg.text}</p>}
                          </div>
                        )}
                        
                        {msg.type === "image" && (
                          <div className="flex flex-col mb-1">
                            <img src={msg.fileUrl} alt={msg.fileName} className="max-w-full rounded-md object-contain max-h-[300px]" />
                            {msg.text && <p className="text-sm text-slate-800 mt-2">{msg.text}</p>}
                          </div>
                        )}
                        
                        {msg.type === "pdf" && (
                          <div className="flex flex-col mb-1">
                            <div className="flex items-center space-x-3 bg-white/50 p-2 rounded-lg border border-slate-200/50 mb-2">
                              <FileText className="w-8 h-8 text-red-500 shrink-0" />
                              <span className="text-sm font-medium text-slate-800 truncate">{msg.fileName}</span>
                            </div>
                            <iframe src={`${msg.fileUrl}#view=FitH&toolbar=0`} className="w-full h-[300px] border-none rounded bg-white" title={msg.fileName} />
                            {msg.text && <p className="text-sm text-slate-800 mt-2">{msg.text}</p>}
                          </div>
                        )}

                        {msg.type === "file" && (
                          <div className="flex flex-col mb-1">
                            <div className="flex items-center space-x-3 bg-white/50 p-3 rounded-lg border border-slate-200/50">
                              <FileIcon className="w-8 h-8 text-slate-500 shrink-0" />
                              <span className="text-sm font-medium text-slate-800 truncate">{msg.fileName}</span>
                            </div>
                            {msg.text && <p className="text-sm text-slate-800 mt-2">{msg.text}</p>}
                          </div>
                        )}

                        <span className="text-[10px] text-slate-400 block text-right mt-1">{msg.time}</span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <div className="bg-white flex flex-col">
                  {attachments.length > 0 && (
                    <div className="px-4 pt-4 flex flex-wrap gap-2 border-t border-slate-200">
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
                  
                  <footer className={`p-4 bg-white ${attachments.length === 0 ? 'border-t border-slate-200' : ''}`}>
                    <div className="flex items-center space-x-2">
                      <button className="p-2 text-slate-400 hover:text-slate-600">
                        <Smile className="h-5 w-5" />
                      </button>
                      <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-slate-600">
                        <Paperclip className="h-5 w-5" />
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
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm focus:ring-1 focus:ring-green-500 focus:outline-none text-slate-900 placeholder-slate-500"
                          placeholder="Digite uma mensagem..."
                        />
                      </div>
                      <button onClick={handleSendMessage} className="bg-green-500 text-white p-2.5 rounded-full hover:bg-green-600 shadow-md flex items-center justify-center">
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </footer>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-slate-500">Selecione uma conversa para iniciar o atendimento</p>
              </div>
            )}
          </main>
        </>
      ) : (
        /* Kanban View */
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
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
            {columns.map(col => (
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
