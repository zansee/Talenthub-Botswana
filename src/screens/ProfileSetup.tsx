import { useEffect, useState, Fragment, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { stepVariants, skillTagVariants } from "@/lib/animations";
import { AnimatedProgress } from "@/components/AnimatedProgress";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Loader2, UserCheck, Check, X, Plus, ArrowRight, Palette, LayoutGrid } from "lucide-react";
import mascot from "@/assets/mascot-transparent.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Theme & Nav data (shared with Settings.tsx) ──────────────────────────────
const ONBOARDING_THEMES = [
  { id: "forest",    name: "Forest",    hex: "#4f6448" },
  { id: "midnight",  name: "Midnight",  hex: "#1e60a3" },
  { id: "sunset",    name: "Sunset",    hex: "#db4e1d" },
  { id: "vaporwave", name: "Vaporwave", hex: "#a61fed" },
  { id: "emerald",   name: "Emerald",   hex: "#0b7a58" },
  { id: "rose",      name: "Rose",      hex: "#e11d48" },
  { id: "amber",     name: "Amber",     hex: "#d97706" },
  { id: "indigo",    name: "Indigo",    hex: "#4338ca" },
  { id: "teal",      name: "Teal",      hex: "#0891b2" },
  { id: "coral",     name: "Coral",     hex: "#f43f5e" },
  { id: "slate",     name: "Slate",     hex: "#475569" },
  { id: "gold",      name: "Gold",      hex: "#b45309" },
];

const ONBOARDING_NAV_STYLES = [
  { id: "classic", name: "Classic",  desc: "Labels & icons" },
  { id: "glass",   name: "Glass",    desc: "Frosted bar" },
  { id: "minimal", name: "Minimal",  desc: "Clean underline" },
  { id: "bubble",  name: "Bubble",   desc: "Pill highlight" },
];

// Mini SVG previews for nav styles
const NavPreview = ({ style, accent }: { style: string; accent: string }) => {
  const icons = ["●", "●", "●", "●"];
  if (style === "classic") {
    return (
      <div className="w-full bg-white rounded-lg overflow-hidden border border-zinc-200" style={{ height: 32 }}>
        <div className="flex items-end justify-around h-full px-1 pb-1">
          {icons.map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: i === 1 ? accent : "#d1d5db" }} />
              <div className="w-4 h-0.5 rounded-full" style={{ background: i === 1 ? accent : "#e5e7eb" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (style === "glass") {
    return (
      <div className="w-full rounded-lg overflow-hidden border border-zinc-200" style={{ height: 32, background: "rgba(255,255,255,0.6)", backdropFilter: "blur(6px)" }}>
        <div className="flex items-center justify-around h-full px-1">
          {icons.map((_, i) => (
            <div key={i} className="w-4 h-4 rounded-md flex items-center justify-center" style={{ background: i === 1 ? accent + "33" : "transparent" }}>
              <div className="w-2 h-2 rounded-full" style={{ background: i === 1 ? accent : "#9ca3af" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (style === "minimal") {
    return (
      <div className="w-full bg-white rounded-lg overflow-hidden border border-zinc-200" style={{ height: 32 }}>
        <div className="flex items-center justify-around h-full px-1">
          {icons.map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: i === 1 ? accent : "#d1d5db" }} />
              <div className="w-4 h-px" style={{ background: i === 1 ? accent : "transparent" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  // bubble
  return (
    <div className="w-full bg-white rounded-lg overflow-hidden border border-zinc-200" style={{ height: 32 }}>
      <div className="flex items-center justify-around h-full px-1">
        {icons.map((_, i) => (
          <div key={i} className="flex items-center justify-center rounded-full px-2 py-1" style={{ background: i === 1 ? accent + "22" : "transparent", minWidth: 24 }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: i === 1 ? accent : "#d1d5db" }} />
          </div>
        ))}
      </div>
    </div>
  );
};

export const INDUSTRIES = [
  "Administration", "Finance & Accounting", "Procurement & Supply Chain",
  "Human Resources", "Information Technology", "Marketing & Communications",
  "Engineering", "Healthcare", "Education & Training", "Legal",
  "Sales & Business Development", "Construction & Property",
  "Agriculture", "Customer Service", "Transport & Logistics", "NGO & Development",
];

export const LOCATIONS = [
  "Gaborone",
  "Francistown",
  "Molepolole",
  "Maun",
  "Serowe",
  "Mogoditshane",
  "Selibe Phikwe",
  "Lobatse",
  "Palapye",
  "Tlokweng",
  "Mahalapye",
  "Orapa",
  "Jwaneng",
  "Other (Botswana)",
  "Outside Botswana",
];

export const QUALIFICATIONS = [
  "Junior Certificate (JC)",
  "BGCSE / High School Certificate",
  "Vocational Certificate",
  "Diploma",
  "Higher/Advanced Diploma",
  "Bachelor's Degree",
  "Honors Degree",
  "Postgraduate Diploma",
  "Master's Degree",
  "Doctorate (PhD)",
  "Professional Qualification (e.g., ACCA, CIMA, CISCO)",
];

export const FIELDS_OF_STUDY: Record<string, string[]> = {
  "Finance & Accounting": ["Accounting", "Finance", "Economics"],
  "Human Resources": ["Human Resources", "Psychology", "Business Administration"],
  "Information Technology": ["Computer Science", "Information Technology", "Software Engineering"],
  "Marketing & Communications": ["Marketing", "Communications", "Public Relations", "Journalism"],
  "Engineering": ["Civil Engineering", "Mechanical Engineering", "Electrical Engineering"],
  "Healthcare": ["Nursing", "Medicine", "Pharmacy", "Public Health"],
  "Education & Training": ["Education", "Teaching"],
  "Legal": ["Law"],
  "Procurement & Supply Chain": ["Supply Chain", "Logistics", "Procurement"],
  "Agriculture": ["Agriculture", "Environmental Science"],
  "Construction & Property": ["Architecture", "Quantity Surveying", "Construction Management"],
  "NGO & Development": ["Development Studies", "Social Work", "International Relations"],
  "Sales & Business Development": ["Marketing", "Business Administration", "Commerce"],
  "Transport & Logistics": ["Logistics", "Transport Management"],
  "Administration": ["Business Administration", "Office Management", "Public Administration"],
  "Customer Service": ["Business Administration", "Communications"],
};

export const fieldsForIndustries = (inds: string[]): string[] => {
  if (inds.length === 0) return Array.from(new Set(Object.values(FIELDS_OF_STUDY).flat())).sort();
  const set = new Set<string>();
  inds.forEach((i) => (FIELDS_OF_STUDY[i] ?? []).forEach((f) => set.add(f)));
  return Array.from(set).sort();
};

export const FIELD_SKILLS: Record<string, string[]> = {
  // IT
  "Computer Science": ["JavaScript", "TypeScript", "React", "Node.js", "Python", "SQL", "Git", "HTML/CSS", "Software Design", "Network Security", "Cloud Computing", "UI/UX Design"],
  "Information Technology": ["Information Technology", "Network Admin", "System Admin", "SQL", "Microsoft Office", "Troubleshooting", "Cybersecurity", "Cloud Computing"],
  "Software Engineering": ["Software Engineering", "JavaScript", "TypeScript", "Python", "React", "Git", "SQL", "Docker", "Algorithms", "Testing & QA"],
  
  // Finance
  "Accounting": ["Bookkeeping", "Financial Reporting", "Taxation", "Auditing", "Sage Pastel", "Excel", "Cost Accounting", "General Ledger", "ACCA", "BAP"],
  "Finance": ["Financial Analysis", "Investment Management", "Budgeting", "Excel", "Data Analysis", "Risk Assessment", "Corporate Finance", "Financial Modeling"],
  "Economics": ["Data Analysis", "Economic Research", "Statistical Analysis", "Excel", "Reporting", "Econometrics", "Policy Analysis"],
  
  // HR & Business
  "Human Resources": ["Recruitment", "Employee Relations", "HR Policies", "Talent Management", "Conflict Resolution", "Performance Management", "Onboarding", "Botswana Labor Law"],
  "Psychology": ["Research Methods", "Counseling", "Data Analysis", "Communication", "Active Listening", "Behavioral Analysis", "Conflict Resolution"],
  "Business Administration": ["Project Management", "Business Planning", "Operations Management", "Excel", "Leadership", "Customer Service", "Scheduling", "Microsoft Office"],
  
  // Marketing & Communications
  "Marketing": ["Social Media Marketing", "Content Creation", "SEO", "Google Analytics", "Branding", "Digital Marketing", "Market Research", "Copywriting"],
  "Communications": ["Public Relations", "Corporate Communication", "Media Relations", "Content Writing", "Public Speaking", "Event Management", "Editing"],
  "Public Relations": ["Media Relations", "Press Releases", "Event Planning", "Crisis Communication", "Branding", "Public Speaking"],
  "Journalism": ["Copywriting", "Interviewing", "News Writing", "Research", "Editing", "Reporting", "Photography"],
  
  // Engineering
  "Civil Engineering": ["AutoCAD", "Structural Analysis", "Project Management", "Site Inspection", "Cost Estimation", "Safety Regulations", "Surveying"],
  "Mechanical Engineering": ["SolidWorks", "CAD Modeling", "Thermodynamics", "Systems Troubleshooting", "Project Planning", "Manufacturing Processes"],
  "Electrical Engineering": ["Circuit Design", "MATLAB", "Electrical Systems", "Troubleshooting", "Power Systems", "PLC Programming"],
  
  // Healthcare
  "Nursing": ["Patient Care", "Clinical Skills", "First Aid/CPR", "Medication Admin", "Patient Education", "Vitals Monitoring", "Healthcare Admin"],
  "Medicine": ["Diagnostics", "Treatment Planning", "Clinical Research", "Patient Counseling", "Medical Records", "Emergency Medicine"],
  "Pharmacy": ["Pharmacology", "Dispensing", "Inventory Management", "Patient Counseling", "Clinical Skills"],
  "Public Health": ["Epidemiology", "Data Collection", "Health Promotion", "Policy Analysis", "Program Evaluation", "Community Outreach"],
  
  // Education
  "Education": ["Lesson Planning", "Classroom Management", "Child Development", "Student Assessment", "Curriculum Design", "Special Education"],
  "Teaching": ["Teaching", "Classroom Management", "Lesson Planning", "Tutoring", "Educational Tech", "Communication"],
  
  // Legal
  "Law": ["Legal Research", "Contract Drafting", "Litigation", "Compliance", "Client Counseling", "Case Analysis", "Mediation", "Advocacy"],
  
  // Supply Chain
  "Supply Chain": ["Inventory Management", "Negotiation", "Supplier Relations", "Strategic Sourcing", "Contract Management", "SAP", "Logistics Planning"],
  "Logistics": ["Logistics Management", "Warehouse Operations", "Distribution", "Inventory Control", "Excel", "Supply Chain"],
  "Procurement": ["Strategic Sourcing", "Negotiation", "Contract Management", "Vendor Relations", "SAP", "Cost Analysis"],
  
  // Agriculture
  "Agriculture": ["Crop Management", "Livestock Management", "Soil Science", "Farm Operations", "Agribusiness", "Pest Control"],
  "Environmental Science": ["Environmental Assessment", "GIS", "Data Collection", "Conservation", "Sustainability", "Report Writing"],
  
  // Construction
  "Architecture": ["AutoCAD", "Revit", "3D Modeling", "Architectural Design", "Building Codes", "Presentation"],
  "Quantity Surveying": ["Cost Estimation", "Bill of Quantities", "Contract Administration", "Tender Preparation", "Budgeting", "Measurement"],
  "Construction Management": ["Project Management", "Site Supervision", "Safety Compliance", "Scheduling", "Subcontractor Management", "Cost Control"],
  
  // NGO
  "Development Studies": ["Community Development", "Grant Writing", "Project M&E", "Policy Research", "Fundraising", "NGO Admin"],
  "Social Work": ["Case Management", "Crisis Intervention", "Counseling", "Advocacy", "Community Outreach", "Reporting"],
  "International Relations": ["Diplomacy", "Policy Analysis", "Research Methods", "Foreign Languages", "Intercultural Communication"],
  
  // General Fallback
  "Administration": ["Microsoft Office", "Office Management", "Data Entry", "Scheduling", "Customer Service", "Billing"],
  "Customer Service": ["Customer Support", "Communication", "Problem Solving", "Conflict Resolution", "CRM Systems", "Retail"],
};

export const getSuggestedSkills = (fieldOfStudy: string, industries: string[]): string[] => {
  if (fieldOfStudy && FIELD_SKILLS[fieldOfStudy]) {
    return FIELD_SKILLS[fieldOfStudy];
  }
  
  const skillsSet = new Set<string>();
  industries.forEach((ind) => {
    if (FIELD_SKILLS[ind]) {
      FIELD_SKILLS[ind].forEach((sk) => skillsSet.add(sk));
    }
  });
  
  if (skillsSet.size > 0) {
    return Array.from(skillsSet).slice(0, 15);
  }
  
  return ["Communication", "Microsoft Office", "Customer Service", "Project Management", "Sales", "Data Entry", "Sage Pastel", "Leadership", "Excel"];
};

type Question = {
  id: number;
  field: string;
  prompt: string;
  subPrompt?: string;
  placeholder?: string;
  type: "text" | "number" | "textarea" | "select" | "multiselect";
  options?: string[];
  validation?: (val: string, extra?: any) => string | null;
};

const getMascotTip = (stepIndex: number): string => {
  switch (stepIndex) {
    case 1: return "Hello! I'm your AI career assistant. Let's start with your full name to set up your profile.";
    case 2: return "We need a way for companies in Botswana to reach you. What's your contact number?";
    case 3: return "Select your town or city. This helps me show you local opportunities close by!";
    case 4: return "Enter your residential address. This will be formatted on your profile for employers.";
    case 5: return "Do you have a P.O. Box? If not, feel free to skip this step.";
    case 6: return "What is your highest qualification? This is a key matching filter for hiring managers.";
    case 7: return "Which institution did you attend? Let's highlight where you learned your craft.";
    case 8: return "What year did you graduate? If you are still studying or skip, that's completely fine!";
    case 9: return "What is your current or most recent job title? This defines your career path.";
    case 10: return "How many years have you been working? It helps me match junior or senior roles.";
    case 11: return "A brief summary of your background helps you stand out. Tell me what makes you great!";
    case 12: return "Which fields or departments are you interested in? Pick all that apply!";
    case 13: return "What was your primary field of study? I've loaded fields matching your selected industries.";
    case 14: return "Finally, select your core skills or add your own below! These are key matching search terms!";
    default: return "Let's complete your profile to find your dream job!";
  }
};

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { colorTheme, setColorTheme, navStyle, setNavStyle } = useApp();
  const [currentStep, setCurrentStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: "", phone: "", current_location: "", residential_address: "",
    postal_address: "", highest_education: "", field_of_study: "",
    institution: "", graduation_year: "",
    years_experience: "", current_job_title: "", skills: "", career_summary: "",
  });
  const [industries, setIndustries] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [customSkillInput, setCustomSkillInput] = useState("");
  // Step 0: show personalisation for first-time users only
  // A returning user already has colorTheme saved — skip straight to Step 1
  const [showPersonalise, setShowPersonalise] = useState<boolean>(
    () => !localStorage.getItem("colorTheme")
  );

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setForm((f) => ({
          ...f,
          full_name: data.full_name ?? "",
          phone: data.phone ?? "",
          current_location: data.current_location ?? "",
          residential_address: data.residential_address ?? "",
          postal_address: data.postal_address ?? "",
          highest_education: data.highest_education ?? "",
          field_of_study: data.field_of_study ?? "",
          institution: (data as any).institution ?? "",
          graduation_year: (data as any).graduation_year != null ? String((data as any).graduation_year) : "",
          years_experience: data.years_experience?.toString() ?? "",
          current_job_title: data.current_job_title ?? "",
          career_summary: (data as any).career_summary ?? "",
          skills: (data.skills ?? []).join(", "),
        }));
        setIndustries(((data as any).preferred_industries ?? []) as string[]);
        setSelectedSkills(data.skills ?? []);
      }
    });
  }, [user, loading, navigate]);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const toggleIndustry = (ind: string) =>
    setIndustries((p) => p.includes(ind) ? p.filter((x) => x !== ind) : [...p, ind]);

  const handleAddCustomSkill = () => {
    const rawInput = customSkillInput.trim();
    if (!rawInput) return;
    
    // Split by commas to allow entering multiple comma-separated skills
    const skillsToAdd = rawInput
      .split(",")
      .map(s => s.trim())
      .filter(s => s.length > 0);
      
    if (skillsToAdd.length === 0) return;

    setSelectedSkills(prev => {
      const next = [...prev];
      let addedAny = false;
      
      skillsToAdd.forEach(skill => {
        if (!next.some(s => s.toLowerCase() === skill.toLowerCase())) {
          next.push(skill);
          addedAny = true;
        }
      });
      
      if (!addedAny && skillsToAdd.length === 1) {
        toast.error("This skill has already been added.");
      } else {
        setForm(f => ({ ...f, skills: next.join(", ") }));
      }
      
      return next;
    });
    setCustomSkillInput("");
  };

  const handleCustomSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustomSkill();
    }
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev => {
      const next = prev.includes(skill)
        ? prev.filter(s => s !== skill)
        : [...prev, skill];
      setForm(f => ({ ...f, skills: next.join(", ") }));
      return next;
    });
  };

  const removeSkill = (skill: string) => {
    setSelectedSkills(prev => {
      const next = prev.filter(s => s !== skill);
      setForm(f => ({ ...f, skills: next.join(", ") }));
      return next;
    });
  };

  const questions: Question[] = [
    {
      id: 1,
      field: "full_name",
      prompt: "Let's start with your name. What is your full name?",
      placeholder: "e.g. Jane Doe",
      type: "text",
      validation: (v) => v.trim().length >= 2 ? null : "Full name must be at least 2 characters.",
    },
    {
      id: 2,
      field: "phone",
      prompt: "What is your phone number?",
      placeholder: "e.g. +267 71 234 567",
      type: "text",
      validation: (v) => v.trim().length >= 5 ? null : "Please enter a valid phone number.",
    },
    {
      id: 3,
      field: "current_location",
      prompt: "Where are you currently located?",
      subPrompt: "Select your city or town from the options below.",
      type: "select",
      options: LOCATIONS,
      validation: (v) => v ? null : "Please select your current location.",
    },
    {
      id: 4,
      field: "residential_address",
      prompt: "What is your residential address?",
      placeholder: "e.g. Plot 1234, Phase 2, Gaborone",
      type: "textarea",
      validation: (v) => v.trim().length >= 2 ? null : "Please enter your residential address.",
    },
    {
      id: 5,
      field: "postal_address",
      prompt: "Do you have a postal address?",
      subPrompt: "Optional - skip if none.",
      placeholder: "e.g. P.O. Box 1234, Gaborone",
      type: "text",
    },
    {
      id: 6,
      field: "highest_education",
      prompt: "What is your highest education qualification?",
      subPrompt: "Select your highest completed level of education.",
      type: "select",
      options: QUALIFICATIONS,
      validation: (v) => v ? null : "Please select your highest qualification.",
    },
    {
      id: 7,
      field: "institution",
      prompt: "Which institution did you attend?",
      subPrompt: "Optional - skip if none.",
      placeholder: "e.g. University of Botswana",
      type: "text",
    },
    {
      id: 8,
      field: "graduation_year",
      prompt: "What year did you graduate?",
      subPrompt: "Optional - skip if none.",
      placeholder: "e.g. 2021",
      type: "number",
      validation: (v) => !v || (Number(v) >= 1950 && Number(v) <= 2100) ? null : "Please enter a valid year between 1950 and 2100.",
    },
    {
      id: 9,
      field: "current_job_title",
      prompt: "What is your current or most recent job title?",
      subPrompt: "Optional - skip if none.",
      placeholder: "e.g. Marketing Coordinator",
      type: "text",
    },
    {
      id: 10,
      field: "years_experience",
      prompt: "How many years of work experience do you have?",
      subPrompt: "Optional - skip if none.",
      placeholder: "e.g. 3",
      type: "number",
      validation: (v) => !v || (Number(v) >= 0 && Number(v) <= 50) ? null : "Enter a valid number of years.",
    },
    {
      id: 11,
      field: "career_summary",
      prompt: "Can you write a brief career summary?",
      subPrompt: "Optional - describe your professional background and goals in a few sentences.",
      placeholder: "Motivated graduate with a strong foundation in digital branding...",
      type: "textarea",
    },
    {
      id: 12,
      field: "preferred_industries",
      prompt: "Which industries or departments are you interested in?",
      subPrompt: "Select one or more industries from the list.",
      type: "multiselect",
      options: INDUSTRIES,
      validation: (_, extra) => extra && extra.length > 0 ? null : "Please select at least one industry.",
    },
    {
      id: 13,
      field: "field_of_study",
      prompt: "What was your primary field of study?",
      subPrompt: "Optional - select the field that closest matches your study path.",
      type: "select",
      options: [], // loaded dynamically
    },
    {
      id: 14,
      field: "skills",
      prompt: "Finally, what are your core skills?",
      subPrompt: "Select suggested skills below or enter your own.",
      placeholder: "e.g. SEO, Excel, Project Management",
      type: "textarea",
      validation: (v) => v.trim().length > 0 ? null : "Please select or add at least one skill.",
    },
  ];

  const currentQuestion = questions[currentStep - 1];

  const directionRef = useRef(1);

  const handleNext = () => {
    if (currentQuestion.validation) {
      let errorStr: string | null = null;
      if (currentQuestion.field === "preferred_industries") {
        errorStr = currentQuestion.validation("", industries);
      } else if (currentQuestion.field === "skills") {
        errorStr = selectedSkills.length > 0 ? null : "Please select or add at least one skill.";
      } else {
        errorStr = currentQuestion.validation(form[currentQuestion.field as keyof typeof form]);
      }

      if (errorStr) {
        toast.error(errorStr);
        return;
      }
    }

    if (currentStep === questions.length) {
      handleSubmit();
    } else {
      directionRef.current = 1;
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep === 1) {
      // New users: go back to personalisation step; returning users navigate away
      if (!localStorage.getItem("_onboarding_personalised")) {
        setShowPersonalise(true);
      } else {
        navigate(-1);
      }
    } else {
      directionRef.current = -1;
      setCurrentStep((s) => s - 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && currentQuestion.type !== "textarea") {
      e.preventDefault();
      handleNext();
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (industries.length === 0) {
      toast.error("Please select at least one industry of interest.");
      setCurrentStep(12);
      return;
    }
    if (selectedSkills.length === 0) {
      toast.error("Please select or add at least one skill.");
      return;
    }
    setBusy(true);
    const payload: any = {
      full_name: form.full_name,
      phone: form.phone,
      current_location: form.current_location,
      residential_address: form.residential_address,
      postal_address: form.postal_address || null,
      highest_education: form.highest_education,
      field_of_study: form.field_of_study || null,
      institution: form.institution || null,
      graduation_year: form.graduation_year ? Number(form.graduation_year) : null,
      years_experience: form.years_experience ? Number(form.years_experience) : null,
      current_job_title: form.current_job_title || null,
      career_summary: form.career_summary || null,
      skills: selectedSkills,
      preferred_industries: industries,
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved!");
    navigate("/upload-cv");
  };

  const progressPercent = (currentStep / questions.length) * 100;
  const isOptional = !currentQuestion.validation;
  const value = form[currentQuestion.field as keyof typeof form] || "";
  const isValueEmpty = currentQuestion.field === "preferred_industries" 
    ? industries.length === 0 
    : currentQuestion.field === "skills"
    ? selectedSkills.length === 0
    : String(value).trim() === "";

  const getStepQuestionText = (q: Question): string => {
    switch (q.field) {
      case "full_name": return "What is your full name?";
      case "phone": return "What is your contact number?";
      case "current_location": return "Where are you currently located?";
      case "residential_address": return "What is your residential address?";
      case "postal_address": return "Do you have a postal address?";
      case "highest_education": return "What is your highest qualification?";
      case "institution": return "Which institution did you attend?";
      case "graduation_year": return "What year did you graduate?";
      case "current_job_title": return "What is your current or most recent job title?";
      case "years_experience": return "How many years of work experience do you have?";
      case "career_summary": return "Can you write a brief career summary?";
      case "preferred_industries": return "Which industries are you interested in?";
      case "field_of_study": return "What was your primary field of study?";
      case "skills": return "Finally, what are your core skills?";
      default: return q.prompt;
    }
  };

  const getStepLabelText = (q: Question): string => {
    switch (q.field) {
      case "full_name": return "Full Name";
      case "phone": return "Phone Number";
      case "current_location": return "Current Location";
      case "residential_address": return "Residential Address";
      case "postal_address": return "Postal Address (Optional)";
      case "highest_education": return "Highest Education";
      case "institution": return "Institution (Optional)";
      case "graduation_year": return "Graduation Year (Optional)";
      case "current_job_title": return "Job Title (Optional)";
      case "years_experience": return "Years of Experience (Optional)";
      case "career_summary": return "Career Summary (Optional)";
      case "preferred_industries": return "Preferred Industries";
      case "field_of_study": return "Field of Study (Optional)";
      case "skills": return "Core Skills";
      default: return q.field.replace("_", " ");
    }
  };

  const getStepTip = (stepIndex: number): string => {
    switch (stepIndex) {
      case 1: return "This helps me personalize your career setup.";
      case 2: return "Employers will use this number to contact you for interviews.";
      case 3: return "This filters jobs based on your proximity.";
      case 4: return "Providing a clear address adds credibility to your profile.";
      case 5: return "Skip if you don't use a postal address.";
      case 6: return "Standardized qualifications increase job match accuracy.";
      case 7: return "Highlight your school, college, or training center.";
      case 8: return "Helps recruiters understand your timeline.";
      case 9: return "If you are looking for your first job, you can skip this step.";
      case 10: return "Enter 0 if you are entry-level or transitioning.";
      case 11: return "Summarize your top skills and career goals.";
      case 12: return "Select at least one industry to start matching jobs.";
      case 13: return "Helps matching specialized degree requirements.";
      case 14: return "Click suggested skills to select them, or type your own custom skill and press Enter.";
      default: return "Complete setup to unlock personalized job matches.";
    }
  };

  const renderInput = () => {
    switch (currentQuestion.type) {
      case "text":
        return (
          <Input
            value={value}
            onChange={(e) => update(currentQuestion.field, e.target.value)}
            placeholder={currentQuestion.placeholder}
            onKeyDown={handleKeyDown}
            className="h-12 rounded-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 text-base focus-visible:ring-primary focus-visible:ring-offset-0 placeholder:text-zinc-400 focus:border-primary focus:bg-white"
            autoFocus
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => update(currentQuestion.field, e.target.value)}
            placeholder={currentQuestion.placeholder}
            onKeyDown={handleKeyDown}
            className="h-12 rounded-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 text-base focus-visible:ring-primary focus-visible:ring-offset-0 placeholder:text-zinc-400 focus:border-primary focus:bg-white"
            autoFocus
          />
        );
      case "textarea":
        if (currentQuestion.field === "skills") {
          const suggestions = getSuggestedSkills(form.field_of_study, industries);
          
          return (
            <div className="space-y-4 text-left">
              {/* Predefined Suggestions */}
              {suggestions.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block pl-1">
                    Suggested Skills ({form.field_of_study || "General"})
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {suggestions.map((skill) => {
                      const isSelected = selectedSkills.includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => toggleSkill(skill)}
                          className={`text-[11px] px-3 py-1.5 rounded-full border transition-all font-semibold flex items-center gap-1 ${
                            isSelected 
                              ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]" 
                              : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300"
                          }`}
                        >
                          {skill}
                          {isSelected && <Check className="w-3 h-3" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Selected / Custom Skills Container */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block pl-1">
                  My Skills ({selectedSkills.length})
                </span>
                {selectedSkills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1 p-2 rounded-xl border border-zinc-200 bg-zinc-50/50">
                    <AnimatePresence mode="popLayout">
                      {selectedSkills.map((skill) => (
                        <motion.span
                          key={skill}
                          variants={skillTagVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          layout
                          className="text-[11px] px-2.5 py-1 rounded-full bg-zinc-800 text-white flex items-center gap-1.5 font-semibold shadow-sm"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => removeSkill(skill)}
                            className="text-zinc-300 hover:text-white focus:outline-none transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="text-center py-4 px-3 rounded-xl border border-dashed border-zinc-200 text-xs text-zinc-400 bg-zinc-50/30">
                    No skills added yet. Click suggestions or type a custom skill below!
                  </div>
                )}
              </div>

              {/* Other Custom Skill Input */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block pl-1">
                  Add Other Skill
                </span>
                <div className="flex gap-2">
                  <Input
                    value={customSkillInput}
                    onChange={(e) => setCustomSkillInput(e.target.value)}
                    onKeyDown={handleCustomSkillKeyDown}
                    placeholder="Type skill & press Add or Enter..."
                    className="h-11 rounded-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 text-sm focus-visible:ring-primary focus-visible:ring-offset-0 placeholder:text-zinc-400 focus:border-primary focus:bg-white flex-1"
                  />
                  <Button
                    type="button"
                    onClick={handleAddCustomSkill}
                    className="h-11 w-11 p-0 rounded-full bg-primary hover:bg-primary/95 text-primary-foreground flex items-center justify-center shrink-0 shadow-lg shadow-primary/10"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        }

        return (
          <Textarea
            value={value}
            onChange={(e) => update(currentQuestion.field, e.target.value)}
            placeholder={currentQuestion.placeholder}
            className="rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-base min-h-[100px] placeholder:text-zinc-400 focus-visible:ring-primary focus-visible:ring-offset-0 focus:border-primary focus:bg-white"
            autoFocus
          />
        );
      case "select":
        const opts = currentQuestion.field === "field_of_study" 
          ? fieldsForIndustries(industries) 
          : currentQuestion.options || [];
        return (
          <Select 
            value={value} 
            onValueChange={(val) => update(currentQuestion.field, val)}
          >
            <SelectTrigger className="h-12 rounded-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 text-base focus:ring-primary focus:border-primary">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent className="bg-white border border-zinc-200 text-zinc-900 max-h-72">
              {opts.map((opt) => (
                <SelectItem key={opt} value={opt} className="hover:bg-zinc-100 cursor-pointer text-sm">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "multiselect":
        return (
          <div className="flex flex-wrap gap-2 pt-2 max-h-56 overflow-y-auto pr-1">
            {(currentQuestion.options || []).map((ind) => {
              const selected = industries.includes(ind);
              return (
                <button
                  key={ind}
                  type="button"
                  onClick={() => toggleIndustry(ind)}
                  className={`text-xs px-4 py-2 rounded-full border transition-all font-semibold ${
                    selected 
                      ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-[1.02]" 
                      : "bg-zinc-50 border border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  {ind}
                </button>
              );
            })}
          </div>
        );
      default:
        return null;
    }
  };

  // ─── Personalisation Step 0 ──────────────────────────────────────────────
  const accentHex = ONBOARDING_THEMES.find(t => t.id === colorTheme)?.hex ?? "#4f6448";

  if (showPersonalise) {
    return (
      <div className="flex-1 flex flex-col bg-[#0a0c10] text-[#e5e7eb] overflow-hidden">
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col max-w-md mx-auto w-full">

          {/* Mascot + bubble */}
          <div className="flex flex-col items-center mt-2 mb-5 shrink-0">
            <div className="relative w-20 h-20 select-none mb-3">
              <img src={mascot} alt="AI Assistant" className="w-full h-full object-contain animate-bob drop-shadow-[0_0_12px_rgba(130,200,80,0.4)]" />
              <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-success border-2 border-[#0a0c10] shadow-[0_0_8px_#22c55e] animate-pulse" />
            </div>
            <div className="bg-white text-zinc-900 rounded-2xl px-4 py-3 shadow-2xl relative border border-zinc-100 text-center max-w-xs">
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-white" />
              <p className="text-xs font-semibold leading-relaxed text-zinc-800">
                Welcome! Let's make the app feel like <em>yours</em>. Pick an accent colour and navigation style before we get started! 🎨
              </p>
            </div>
          </div>

          {/* ── Colour Picker ── */}
          <div className="bg-white/5 rounded-2xl p-4 mb-4 border border-white/8">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4" style={{ color: accentHex }} />
              <p className="text-sm font-bold text-white">Accent Colour</p>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {ONBOARDING_THEMES.map((t) => {
                const selected = colorTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setColorTheme(t.id)}
                    className="flex flex-col items-center gap-1 group"
                    title={t.name}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                        selected ? "scale-110 shadow-lg" : "opacity-70 hover:opacity-100 hover:scale-105"
                      }`}
                      style={{
                        background: t.hex,
                        boxShadow: selected ? `0 0 0 3px #0a0c10, 0 0 0 5px ${t.hex}` : undefined,
                      }}
                    >
                      {selected && <div className="w-3 h-3 rounded-full bg-white shadow" />}
                    </div>
                    <span className={`text-[9px] font-semibold leading-none text-center ${
                      selected ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                    }`}>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Nav Style Picker ── */}
          <div className="bg-white/5 rounded-2xl p-4 mb-6 border border-white/8">
            <div className="flex items-center gap-2 mb-3">
              <LayoutGrid className="w-4 h-4" style={{ color: accentHex }} />
              <p className="text-sm font-bold text-white">Navigation Style</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {ONBOARDING_NAV_STYLES.map((ns) => {
                const selected = navStyle === ns.id;
                return (
                  <button
                    key={ns.id}
                    type="button"
                    onClick={() => setNavStyle(ns.id)}
                    className={`rounded-xl p-3 border-2 transition-all duration-200 text-left ${
                      selected
                        ? "border-white/40 bg-white/10 scale-[1.02]"
                        : "border-white/8 bg-white/3 hover:bg-white/8"
                    }`}
                    style={selected ? { borderColor: accentHex + "99" } : {}}
                  >
                    {/* Mini preview */}
                    <div className="mb-2">
                      <NavPreview style={ns.id} accent={accentHex} />
                    </div>
                    <p className={`text-xs font-bold ${ selected ? "text-white" : "text-zinc-400" }`}>{ns.name}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{ns.desc}</p>
                    {selected && (
                      <div className="mt-1.5 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: accentHex }} />
                        <span className="text-[10px] font-semibold" style={{ color: accentHex }}>Selected</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Let's Go Button ── */}
          <button
            type="button"
            onClick={() => {
              // Mark that personalisation was completed so back button from Step 1 navigates away
              localStorage.setItem("_onboarding_personalised", "1");
              setShowPersonalise(false);
            }}
            className="w-full h-14 rounded-2xl font-bold text-white flex items-center justify-center gap-2 text-base shadow-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: `linear-gradient(135deg, ${accentHex}, ${accentHex}cc)`, boxShadow: `0 8px 32px ${accentHex}55` }}
          >
            Let's Go
            <ArrowRight className="w-5 h-5" />
          </button>

          <p className="text-center text-[10px] text-zinc-600 mt-3">You can change these anytime in Settings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0a0c10] text-[#e5e7eb] overflow-hidden">
      {/* Top Header & Progress */}
      <div className="p-6 pb-2 space-y-4 shrink-0">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center transition-colors text-muted-foreground hover:text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-300 uppercase tracking-widest bg-white/5 px-4 py-1 rounded-full border border-white/10">
            SETUP: STEP {currentStep}
          </div>
          <div className="w-9 h-9 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-primary animate-pulse">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between items-center text-xs text-muted-foreground font-semibold">
            <span>STEP {currentStep} OF {questions.length}</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <AnimatedProgress
            value={progressPercent}
            className="h-1.5 bg-white/5"
            barClassName="bg-primary"
          />
        </div>
      </div>

      {/* Mascot Avatar Section */}
      <div className="flex flex-col items-center justify-center mt-4 shrink-0 relative">
        <div className="relative w-20 h-20 select-none">
          <img
            src={mascot}
            alt="AI Assistant"
            className="w-full h-full object-contain animate-bob drop-shadow-[0_0_12px_rgba(130,200,80,0.4)]"
          />
          {/* Online green indicator dot */}
          <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-success border-2 border-[#0a0c10] shadow-[0_0_8px_#22c55e] animate-pulse" />
        </div>
      </div>

      {/* Mascot Speech Bubble */}
      <div className="px-6 mt-4 shrink-0 max-w-sm mx-auto w-full select-none">
        <div className="bg-white text-zinc-900 rounded-2xl p-4 shadow-2xl relative border border-zinc-100 text-center">
          {/* Arrow pointing up */}
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-6 border-l-transparent border-r-6 border-r-transparent border-b-6 border-b-white" />
          <p className="text-xs sm:text-sm font-semibold leading-relaxed text-zinc-800">
            {getMascotTip(currentStep)}
          </p>
        </div>
      </div>

      {/* Main Slide Card */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col justify-start max-w-md mx-auto w-full">
        <div className="bg-white text-zinc-950 rounded-3xl p-6 shadow-2xl space-y-5 border border-zinc-100 flex flex-col justify-between">
          <AnimatePresence mode="wait" custom={directionRef.current}>
            <motion.div
              key={currentStep}
              custom={directionRef.current}
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="space-y-4">
                {/* Center aligned Question */}
                <h2 className="text-lg font-bold text-center text-zinc-800 leading-snug">
                  {getStepQuestionText(currentQuestion)}
                </h2>

                {/* Input Label & Field */}
                <div className="space-y-1.5 pt-2">
                  <label className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase block pl-1">
                    {getStepLabelText(currentQuestion)}
                  </label>
                  <div className="pt-0.5">
                    {renderInput()}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Action Button & Tip */}
          <div className="space-y-3 pt-4">
            <div className="flex gap-2">
              {currentStep > 1 && (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1 h-12 rounded-full text-xs font-bold border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                >
                  Back
                </Button>
              )}
              <Button
                onClick={handleNext}
                disabled={busy}
                className="flex-1 h-12 bg-primary hover:bg-primary/95 text-primary-foreground rounded-full text-sm font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20 transition-all hover:scale-[1.01]"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : currentStep === questions.length ? (
                  "Submit Profile"
                ) : (isOptional && isValueEmpty) ? (
                  "Skip"
                ) : (
                  <>
                    Continue <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
            
            {/* Center aligned Tip */}
            <p className="text-[10px] sm:text-xs text-center text-zinc-400 italic font-medium leading-normal px-2">
              Tip: {getStepTip(currentStep)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
