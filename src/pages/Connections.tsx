import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { io, Socket } from "socket.io-client";
import { RefreshCw, CheckCircle2, AlertTriangle, Smartphone, XCircle } from "lucide-react";

export function Connections() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<"connecting" | "qr" | "connected" | "disconnected" | "reconnecting" | "failed">("connecting");
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Create socket connection
    const newSocket = io({
      path: "/socket.io"
    });

    newSocket.on("connect", () => {
      console.log("Connected to websocket");
      newSocket.emit("whatsapp:status");
    });

    newSocket.on("whatsapp:state", (data) => {
      if (data.state === "qr") {
        setQrCode(data.qr);
        setStatus("qr");
      } else {
        setStatus(data.state);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const resetConnection = () => {
    if (socket) {
      setStatus("connecting");
      setQrCode(null);
      socket.emit("whatsapp:reset");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#efeae2] font-sans">
      <div className="sm:flex sm:items-center mb-6 md:mb-8">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-slate-900">Conexões WhatsApp</h1>
          <p className="mt-2 text-sm text-slate-600">
            Gerencie as conexões do WhatsApp com o sistema.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-2xl">
        <div className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">WhatsApp Oficial</h3>
                <div className="flex items-center mt-1">
                  {status === "connected" && (
                    <span className="flex items-center text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Conectado
                    </span>
                  )}
                  {status === "qr" && (
                    <span className="flex items-center text-xs font-semibold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Aguardando Leitura do QR Code
                    </span>
                  )}
                  {status === "connecting" && (
                    <span className="flex items-center text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> Conectando...
                    </span>
                  )}
                  {status === "reconnecting" && (
                    <span className="flex items-center text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                      <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> Reconectando...
                    </span>
                  )}
                  {status === "disconnected" && (
                    <span className="flex items-center text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Desconectado
                    </span>
                  )}
                  {status === "failed" && (
                    <span className="flex items-center text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Falha na Conexão
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <button
              onClick={resetConnection}
              className="flex items-center justify-center px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-semibold w-full md:w-auto"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Resetar Conexão
            </button>
          </div>

          {status === "qr" && qrCode && (
            <div className="mt-8 flex flex-col items-center justify-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
              <h4 className="text-sm font-bold text-slate-700 mb-4 text-center">Leia o QR Code para conectar</h4>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <QRCodeSVG value={qrCode} size={256} />
              </div>
              <p className="mt-4 text-xs text-slate-500 max-w-sm text-center px-4">
                Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e aponte a câmera para o código acima.
              </p>
            </div>
          )}

          {status === "connected" && (
            <div className="mt-8 flex flex-col items-center justify-center py-10 border-2 border-dashed border-green-200 rounded-xl bg-green-50">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-green-800 mb-2">WhatsApp Conectado!</h4>
              <p className="text-sm text-green-700 text-center px-4">
                Seu número está sincronizado e pronto para enviar e receber mensagens.
              </p>
            </div>
          )}

          {(status === "disconnected" || status === "failed") && (
            <div className="mt-8 flex flex-col items-center justify-center py-10 border-2 border-dashed border-red-200 rounded-xl bg-red-50">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                {status === "failed" ? <XCircle className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
              </div>
              <h4 className="text-lg font-bold text-red-800 mb-2">
                {status === "failed" ? "Falha ao Conectar" : "Conexão Perdida"}
              </h4>
              <p className="text-sm text-red-700 text-center mb-4 px-4">
                {status === "failed" 
                  ? "O limite de tentativas de reconexão foi atingido. Clique em resetar para iniciar novamente."
                  : "O WhatsApp foi desconectado. Clique em resetar para gerar um novo QR Code."}
              </p>
              <button
                onClick={resetConnection}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold"
              >
                Tentar Novamente
              </button>
            </div>
          )}

          {status === "reconnecting" && (
             <div className="mt-8 flex flex-col items-center justify-center py-10 border-2 border-dashed border-orange-200 rounded-xl bg-orange-50">
              <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-4">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
              <h4 className="text-lg font-bold text-orange-800 mb-2">Reconectando...</h4>
              <p className="text-sm text-orange-700 text-center px-4">
                Tentando restabelecer a conexão com o WhatsApp. Por favor, aguarde.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
