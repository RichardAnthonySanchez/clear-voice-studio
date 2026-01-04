import { DictationProcessor } from '@/components/DictationProcessor';

const Index = () => {
  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl translate-y-1/2" />
      
      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-12 md:py-16">
        <DictationProcessor />
      </div>
    </main>
  );
};

export default Index;
