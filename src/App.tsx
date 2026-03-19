/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Send, Bot, User, Trash2, Copy, Check, Settings2, Sparkles } from 'lucide-react';

// Declare puter global
declare global {
  interface Window {
    puter: any;
  }
}

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  modelName?: string;
}

interface Model {
  id: string;
  name: string;
  provider: string;
  context?: number;
}

const CodeBlock = ({ language, value }: { language: string, value: string }) => {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(value);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-gray-200/20 bg-[#1e1e1e] shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] text-gray-300 text-xs font-sans border-b border-gray-700/50">
        <span className="font-medium">{language || 'text'}</span>
        <button 
          onClick={copyToClipboard} 
          className="flex items-center gap-1.5 hover:text-white transition-colors focus:outline-none"
          aria-label="Copy code"
        >
          {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          {isCopied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={vscDarkPlus}
        customStyle={{ margin: 0, padding: '1rem', fontSize: '0.875rem', background: '#1e1e1e' }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

export default function App() {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'ai',
      content: "Hello! I'm your AI assistant powered by Puter.js. Select a model from the dropdown above and start chatting!"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModelsLoading, setIsModelsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadModels = async () => {
    try {
      setIsModelsLoading(true);
      setError(null);
      
      let retries = 0;
      while (!window.puter && retries < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        retries++;
      }

      if (!window.puter) {
        throw new Error("Puter.js failed to load");
      }

      const availableModels = await window.puter.ai.listModels();
      setModels(availableModels);
      
      const defaultModel = availableModels.find((m: Model) => m.id === 'gpt-4o' || m.id === 'claude-3.7-sonnet');
      if (defaultModel) {
        setSelectedModel(defaultModel.id);
      } else if (availableModels.length > 0) {
        setSelectedModel(availableModels[0].id);
      }
    } catch (err: any) {
      console.error('Error loading models:', err);
      setError(`Failed to load models: ${err.message}`);
      
      const fallbackModels = [
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
        { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'claude' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google' }
      ];
      setModels(fallbackModels);
      setSelectedModel('gpt-4o');
    } finally {
      setIsModelsLoading(false);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || !selectedModel || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedInput
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    setIsLoading(true);
    setError(null);

    const aiMessageId = (Date.now() + 1).toString();
    const currentModelName = models.find(m => m.id === selectedModel)?.name || selectedModel;

    try {
      setMessages(prev => [...prev, {
        id: aiMessageId,
        role: 'ai',
        content: '',
        modelName: currentModelName
      }]);

      if (selectedModel.includes('stream') || selectedModel.includes('claude') || selectedModel.includes('gpt')) {
        const response = await window.puter.ai.chat(trimmedInput, { 
          model: selectedModel,
          stream: true,
          temperature: 0.7
        });
        
        let fullResponse = '';
        for await (const part of response) {
          if (part?.text) {
            fullResponse += part.text;
            setMessages(prev => prev.map(msg => 
              msg.id === aiMessageId ? { ...msg, content: fullResponse } : msg
            ));
          }
        }
      } else {
        const response = await window.puter.ai.chat(trimmedInput, { model: selectedModel });
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId ? { ...msg, content: response } : msg
        ));
      }
    } catch (err: any) {
      console.error('Error:', err);
      setError(`Error: ${err.message}`);
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId ? { ...msg, content: 'Sorry, an error occurred while processing your request.' } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'init',
        role: 'ai',
        content: "Hello! I'm your AI assistant powered by Puter.js. Select a model from the dropdown above and start chatting!"
      }
    ]);
    setShowClearConfirm(false);
  };

  const modelsByProvider = models.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, Model[]>);

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Header */}
      <header className="flex-none flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200">
            <Sparkles className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 leading-tight">AI Studio</h1>
            <p className="text-xs text-gray-500 font-medium">Powered by Puter.js</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
            <Settings2 size={16} className="text-gray-500" />
            <select 
              id="model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isModelsLoading}
              className="bg-transparent border-none text-sm font-medium text-gray-700 focus:ring-0 cursor-pointer outline-none min-w-[160px]"
            >
              {isModelsLoading ? (
                <option value="">Loading models...</option>
              ) : (
                Object.entries(modelsByProvider).map(([provider, providerModels]: [string, Model[]]) => (
                  <optgroup key={provider} label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
                    {providerModels.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name || model.id} {model.context ? `(${Math.floor(model.context / 1000)}k)` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))
              )}
            </select>
          </div>
          
          <button 
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Clear Chat"
          >
            <Trash2 size={18} />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 text-red-700 px-6 py-3 border-b border-red-100 flex items-center gap-2 text-sm">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                
                {/* Avatar */}
                <div className="flex-shrink-0 mt-1">
                  {msg.role === 'user' ? (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <User size={16} className="text-gray-600" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <Bot size={16} className="text-indigo-600" />
                    </div>
                  )}
                </div>

                {/* Message Content */}
                <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <span className="text-xs font-medium text-gray-400 mb-1 px-1">
                    {msg.role === 'user' ? 'You' : (msg.modelName || 'AI Assistant')}
                  </span>
                  
                  <div className={`px-5 py-3.5 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'bg-gray-100 text-gray-900 rounded-tr-sm' 
                      : 'bg-white border border-gray-200 shadow-sm rounded-tl-sm w-full'
                  }`}>
                    {msg.role === 'user' ? (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="prose prose-slate prose-sm max-w-none">
                        {msg.content ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code(props) {
                                const {children, className, node, ...rest} = props
                                const match = /language-(\w+)/.exec(className || '')
                                return match ? (
                                  <CodeBlock 
                                    language={match[1]} 
                                    value={String(children).replace(/\n$/, '')} 
                                  />
                                ) : (
                                  <code {...rest} className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded-md font-mono text-xs">
                                    {children}
                                  </code>
                                )
                              }
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        ) : (
                          <div className="flex gap-1.5 items-center h-5">
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-typing"></span>
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-typing" style={{ animationDelay: '0.2s' }}></span>
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-typing" style={{ animationDelay: '0.4s' }}></span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <div className="flex-none bg-white border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto relative flex items-end gap-2">
          {/* Mobile model selector */}
          <div className="md:hidden absolute -top-12 left-0 right-0 flex justify-center">
            <select 
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isModelsLoading}
              className="bg-white border border-gray-200 rounded-full px-4 py-1.5 text-xs font-medium text-gray-700 shadow-sm focus:outline-none"
            >
              {isModelsLoading ? (
                <option value="">Loading...</option>
              ) : (
                Object.entries(modelsByProvider).map(([provider, providerModels]: [string, Model[]]) => (
                  <optgroup key={provider} label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
                    {providerModels.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name || model.id}
                      </option>
                    ))}
                  </optgroup>
                ))
              )}
            </select>
          </div>

          <div className="relative flex-1 bg-gray-50 border border-gray-200 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Message AI Studio..."
              rows={1}
              className="w-full bg-transparent border-none pl-4 pr-14 py-3.5 text-sm text-gray-900 resize-none max-h-[200px] focus:outline-none focus:ring-0"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading || !selectedModel}
              className="absolute right-2 bottom-2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <Send size={18} className={input.trim() && !isLoading ? "translate-x-0.5 -translate-y-0.5 transition-transform" : ""} />
            </button>
          </div>
        </div>
        <div className="text-center mt-2">
          <p className="text-[10px] text-gray-400 font-medium">AI can make mistakes. Consider verifying important information.</p>
        </div>
      </div>

      {/* Clear Chat Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl animate-fadeIn">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Clear Chat</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to clear the chat history? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={clearChat}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
              >
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
