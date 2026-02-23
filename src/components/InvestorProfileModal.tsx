import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Option {
  id: string;
  text: string;
  weight_start: number;
  weight_pro: number;
  weight_specialist: number;
}

interface Question {
  id: string;
  text: string;
  order_num: number;
  options: Option[];
}

interface InvestorProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const InvestorProfileModal = ({
  open,
  onOpenChange,
  onComplete,
}: InvestorProfileModalProps) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadQuestions();
    }
  }, [open]);

  const loadQuestions = async () => {
    try {
      const { data: questionsData, error: questionsError } = await supabase
        .from("profile_questions")
        .select("*")
        .order("order_num");

      if (questionsError) throw questionsError;

      const { data: optionsData, error: optionsError } = await supabase
        .from("profile_options")
        .select("*");

      if (optionsError) throw optionsError;

      const questionsWithOptions = questionsData.map((q) => ({
        ...q,
        options: optionsData.filter((o) => o.question_id === q.id),
      }));

      setQuestions(questionsWithOptions);
    } catch (error) {
      console.error("Erro ao carregar questionário:", error);
      toast.error("Erro ao carregar o questionário");
    }
  };

  const handleAnswer = (optionId: string) => {
    setAnswers({
      ...answers,
      [questions[currentQuestion].id]: optionId,
    });
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const calculateProfile = () => {
    let startCount = 0;
    let proCount = 0;
    let specialistCount = 0;

    Object.entries(answers).forEach(([questionId, optionId]) => {
      const question = questions.find((q) => q.id === questionId);
      const option = question?.options.find((o) => o.id === optionId);

      if (option) {
        if (option.weight_start > 0) startCount++;
        if (option.weight_pro > 0) proCount++;
        if (option.weight_specialist > 0) specialistCount++;
      }
    });

    if (specialistCount >= 2) return "SPECIALIST";
    if (proCount >= 2) return "PRO";
    return "START";
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const profile = calculateProfile();

      // Get current cycle number
      const { data: existingAnswers } = await supabase
        .from("profile_answers")
        .select("cycle")
        .eq("user_id", user.id)
        .order("cycle", { ascending: false })
        .limit(1);

      const cycle = existingAnswers && existingAnswers.length > 0 
        ? existingAnswers[0].cycle + 1 
        : 1;

      // Save answers
      const answersToInsert = Object.entries(answers).map(
        ([questionId, optionId]) => ({
          user_id: user.id,
          question_id: questionId,
          option_id: optionId,
          cycle,
        })
      );

      const { error: answersError } = await supabase
        .from("profile_answers")
        .insert(answersToInsert);

      if (answersError) throw answersError;

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          investor_profile: profile,
          last_reclassification_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      toast.success(`Perfil definido como ${profile}!`);
      onComplete();
      onOpenChange(false);
      setCurrentQuestion(0);
      setAnswers({});
    } catch (error) {
      console.error("Erro ao salvar respostas:", error);
      toast.error("Erro ao salvar o questionário");
    } finally {
      setLoading(false);
    }
  };

  const currentAnswer = answers[questions[currentQuestion]?.id];
  const isLastQuestion = currentQuestion === questions.length - 1;
  const canProceed = currentAnswer !== undefined;

  if (questions.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Questionário de Perfil de Investidor</DialogTitle>
          <DialogDescription>
            Pergunta {currentQuestion + 1} de {questions.length}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <h3 className="text-lg font-medium mb-4">
            {questions[currentQuestion].text}
          </h3>

          <RadioGroup
            value={currentAnswer}
            onValueChange={handleAnswer}
            className="space-y-3"
          >
            {questions[currentQuestion].options.map((option) => (
              <div
                key={option.id}
                className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent cursor-pointer"
              >
                <RadioGroupItem value={option.id} id={option.id} />
                <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                  {option.text}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="flex justify-between gap-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentQuestion === 0 || loading}
          >
            Voltar
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed || loading}
          >
            {loading ? "Salvando..." : isLastQuestion ? "Concluir" : "Próxima"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvestorProfileModal;
