'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const InteractiveMap = dynamic(() => import('@/components/interactive-map'), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center bg-blue-50">Načítám mapu...</div>
});

// Helper function to convert markdown-like formatting to HTML
const formatMessageContent = (content: string) => {
  // Replace **text** with <strong>text</strong>
  let formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Replace *text* with <em>text</em>
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  return formatted;
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Place {
  name: string;
  description: string;
  address: string;
  web: string;
  phone: string;
  category: string;
  emoji: string;
  coordinates: [number, number];
  type: string;
}

export default function BrouzdalPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Ahoj! 👋 Jsem Brouzdal, tvůj AI průvodce po Královéhradeckém kraji! 🏰🌳\n\nPomůžu ti naplánovat perfektní výlet! ✨ Řekni mi, co máš v plánu:\n\n💕 Romantické rande?\n👨‍👩‍👧‍👦 Rodinný výlet s dětmi?\n🏃 Aktivní den v přírodě?\n🎭 Kulturní zážitek?\n🍺 Pivní túra?\n🏰 Historická místa?\n\nJsem tu pro tebe! 😊',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recommendedPlaces, setRecommendedPlaces] = useState<any[]>([]);
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number]>([50.2091, 15.8327]); // Hradec Králové default
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.log('Geolocation error:', error);
          // Keep default location
        }
      );
    }
  }, []);

  // Load sample places on mount
  useEffect(() => {
    loadSamplePlaces();
  }, []);

  const loadSamplePlaces = async () => {
    try {
      const response = await fetch('/api/places-search?limit=100');
      const data = await response.json();
      if (data.places) {
        setAllPlaces(data.places);
        console.log('Loaded places:', data.places.length);
        console.log('Sample places:', data.places.slice(0, 5).map((p: Place) => p.name));
      }
    } catch (error) {
      console.error('Error loading places:', error);
    }
  };

  const extractRecommendedPlaces = (message: string, allPlaces: Place[]) => {
    const lines = message.split('\n');
    const recommendedSection = lines.findIndex(line => 
      line.includes('DOPORUČENÁ MÍSTA:') || line.includes('DOPORUCENA MISTA:')
    );

    console.log('Extracting places, section found at:', recommendedSection);
    if (recommendedSection === -1) return [];

    const recommendations: any[] = [];
    for (let i = recommendedSection + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;
      
      const parts = line.split('|');
      if (parts.length >= 1) {
        const placeName = parts[0].trim().replace(/^-\s*/, '').replace(/^\d+\.\s*/, '');
        console.log('Looking for place:', placeName);
        
        // Find in available places - try multiple matching strategies
        let place = allPlaces.find(p => 
          p.name.toLowerCase() === placeName.toLowerCase()
        );
        
        // If exact match not found, try partial match
        if (!place) {
          place = allPlaces.find(p => 
            p.name.toLowerCase().includes(placeName.toLowerCase()) ||
            placeName.toLowerCase().includes(p.name.toLowerCase())
          );
        }
        
        // Try removing common words and matching
        if (!place) {
          const cleanedSearch = placeName.toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s]/g, '');
          place = allPlaces.find(p => {
            const cleanedName = p.name.toLowerCase()
              .replace(/\s+/g, ' ')
              .replace(/[^\w\s]/g, '');
            return cleanedName.includes(cleanedSearch) || cleanedSearch.includes(cleanedName);
          });
        }

        if (place) {
          console.log('Found place:', place.name);
          recommendations.push({
            type: 'Feature',
            geometry: {
              type: place.type,
              coordinates: place.coordinates
            },
            properties: {
              nazev: place.name,
              popis: place.description,
              adresa: place.address,
              web: place.web,
              telefon: place.phone
            },
            category: place.category,
            emoji: place.emoji
          });
        } else {
          console.log('Place not found in database:', placeName);
        }
      }
    }

    console.log('Total recommendations:', recommendations.length);
    return recommendations;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    sendMessageToAPI([...messages, userMessage]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickPrompts = [
    "Chci romantické rande 💕",
    "Rodinný výlet s dětmi 👨‍👩‍👧‍👦",
    "Aktivní den v přírodě 🏃",
    "Kulturní zážitek 🎭",
    "Pivní túra 🍺",
    "Historická místa 🏰"
  ];

  // Auto-send when clicking quick prompt
  const handleQuickPrompt = (prompt: string) => {
    if (isLoading) return;
    
    const userMessage: Message = {
      role: 'user',
      content: prompt,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    // Send immediately
    sendMessageToAPI([...messages, userMessage]);
  };

  const sendMessageToAPI = async (messageHistory: Message[]) => {
    // Clear previous recommendations when sending new message
    setRecommendedPlaces([]);
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messageHistory.map(m => ({
            role: m.role,
            content: m.content
          })),
          availablePlaces: allPlaces.slice(0, 50)
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Extract and display recommended places on map
      const recommended = extractRecommendedPlaces(data.message, allPlaces);
      console.log('Recommended places found:', recommended.length);
      if (recommended.length > 0) {
        setRecommendedPlaces(recommended);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Omlouvám se, něco se pokazilo. Zkus to prosím znovu. 😔',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Clean message for display (remove the recommendation section)
  const cleanMessageForDisplay = (content: string) => {
    const lines = content.split('\n');
    const recommendedSection = lines.findIndex(line => 
      line.includes('DOPORUČENÁ MÍSTA:') || line.includes('DOPORUCENA MISTA:')
    );
    
    if (recommendedSection === -1) return content;
    return lines.slice(0, recommendedSection).join('\n').trim();
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100">
      {/* Navbar */}
      <nav className="bg-white/90 backdrop-blur-md border-b border-blue-200 z-50 shadow-sm">
        <div className="max-w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-xl font-bold text-blue-600 flex items-center gap-2">
                <Image src="/logo.png" alt="ZabrouzdAi" width={32} height={32} />
                <span>ZabrouzdAi</span>
              </Link>
              <div className="hidden md:flex gap-6">
                <Link href="/" className="text-gray-600 hover:text-blue-600">
                  Objevuj
                </Link>
                <Link href="/mapa" className="text-gray-600 hover:text-blue-600">
                  Mapa okolí
                </Link>
                <Link href="/brouzdal" className="text-blue-600 font-semibold">
                  Brouzdal
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat Section - 1/2 */}
        <div className="w-full md:w-1/2 flex flex-col bg-white/80 backdrop-blur-md border-r border-blue-200">
          {/* Chat Header */}
          <div className="p-4 border-b border-blue-200 text-center">
            <div className="flex justify-center mb-2">
              <Image src="/brouzdal.png" alt="Brouzdal" width={120} height={48} className="object-contain" />
            </div>
            <p className="text-sm text-gray-600">
              Tvůj osobní průvodce plánováním výletů 🗺️✨
            </p>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <div 
                      className="whitespace-pre-wrap [&_strong]:font-bold [&_em]:italic"
                      dangerouslySetInnerHTML={{ 
                        __html: formatMessageContent(cleanMessageForDisplay(message.content))
                      }}
                    />
                    <p className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Quick Prompts */}
          {messages.length === 1 && (
            <div className="px-4 pb-2">
              <p className="text-sm text-gray-600 mb-2">Nebo vyber rychlou volbu:</p>
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickPrompt(prompt)}
                    disabled={isLoading}
                    className="bg-white/80 hover:bg-blue-50 border-blue-200 text-blue-700 text-xs"
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-blue-200">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Napiš, co plánuješ..."
                className="flex-1 bg-white/90 border-blue-200"
                disabled={isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white"
              >
                {isLoading ? '...' : 'Odeslat'}
              </Button>
            </div>
          </div>
        </div>

        {/* Map Section - 1/2 */}
        <div className="hidden md:flex md:w-1/2 flex-col bg-white/80">
          <div className="p-4 border-b border-blue-200">
            <h2 className="text-xl font-bold text-blue-600">
              {recommendedPlaces.length > 0 ? '📍 Doporučená místa' : '🗺️ Mapa'}
            </h2>
            <p className="text-sm text-gray-600">
              {recommendedPlaces.length > 0 
                ? `Zobrazeno ${recommendedPlaces.length} doporučených míst`
                : 'Požádej Brouzdala o doporučení a ukážu ti je na mapě!'}
            </p>
          </div>
          <div className="flex-1">
            <InteractiveMap 
              features={recommendedPlaces} 
              filters={{ transport: false, places: true }}
              userLocation={userLocation}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
