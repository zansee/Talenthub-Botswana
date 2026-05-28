import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Star, Send, Check, Download, Bookmark, BookmarkCheck, ListFilter, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface CoTalentSearchProps {
  userId: string;
  role: string;
}

export const CoTalentSearch = ({ userId }: CoTalentSearchProps) => {
  const [activeSubTab, setActiveSubTab] = useState<"search" | "highlights" | "requests">("search");
  const [loading, setLoading] = useState(true);
  
  // Candidates Data
  const [candidates, setCandidates] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  // Highlights state for icons
  const [highlightedMap, setHighlightedMap] = useState<Record<string, boolean>>({});
  const [requestedMap, setRequestedMap] = useState<Record<string, string>>({}); // candidate_id -> status

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [expFilter, setExpFilter] = useState("all");
  const [qualFilter, setQualFilter] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");
  
  const [busyCandidateId, setBusyCandidateId] = useState<string | null>(null);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch current user's highlights
      const { data: hData } = await supabase
        .from("highlighted_candidates")
        .select("id, candidate_id")
        .eq("employer_id", userId);
      
      const newHighlightedMap: Record<string, boolean> = {};
      if (hData) {
        hData.forEach((h) => {
          newHighlightedMap[h.candidate_id] = true;
        });
      }
      setHighlightedMap(newHighlightedMap);

      // 2. Fetch current user's CV requests
      const { data: rData } = await supabase
        .from("cv_requests")
        .select("id, candidate_id, status")
        .eq("employer_id", userId);
      
      const newRequestedMap: Record<string, string> = {};
      if (rData) {
        rData.forEach((r) => {
          newRequestedMap[r.candidate_id] = r.status;
        });
      }
      setRequestedMap(newRequestedMap);

      // 3. Fetch candidates (regular job-seekers)
      const { data: cData, error: cErr } = await supabase
        .from("profiles")
        .select("id, full_name, current_job_title, years_experience, highest_education, career_summary, skills, industries")
        .not("account_type", "in", '("employer","quick_jobs","partner","job_poster")')
        .neq("id", userId)
        .order("full_name", { ascending: true });

      if (cErr) throw cErr;
      setCandidates(cData || []);

    } catch (err: any) {
      console.error("Error loading talent pool:", err.message);
      toast.error("Failed to load talent pool.");
    } finally {
      setLoading(false);
    }
  };

  const loadHighlights = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("highlighted_candidates")
        .select(`
          id,
          candidate_id,
          profiles:candidate_id (
            id,
            full_name,
            current_job_title,
            years_experience,
            highest_education,
            career_summary,
            skills
          )
        `)
        .eq("employer_id", userId);

      if (error) throw error;
      setHighlights(data || []);
    } catch (err: any) {
      toast.error("Failed to load highlights.");
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("cv_requests")
        .select(`
          id,
          candidate_id,
          status,
          cv_path,
          created_at,
          profiles:candidate_id (
            id,
            full_name,
            current_job_title,
            highest_education
          )
        `)
        .eq("employer_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err: any) {
      toast.error("Failed to load CV requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === "search") {
      loadInitialData();
    } else if (activeSubTab === "highlights") {
      loadHighlights();
    } else if (activeSubTab === "requests") {
      loadRequests();
    }
  }, [activeSubTab]);

  const handleToggleHighlight = async (candidateId: string) => {
    const isHighlighted = highlightedMap[candidateId];
    try {
      setBusyCandidateId(candidateId);
      if (isHighlighted) {
        // Remove
        const { error } = await supabase
          .from("highlighted_candidates")
          .delete()
          .eq("employer_id", userId)
          .eq("candidate_id", candidateId);

        if (error) throw error;
        setHighlightedMap((prev) => ({ ...prev, [candidateId]: false }));
        toast.success("Candidate removed from highlights");
      } else {
        // Add
        const { error } = await supabase
          .from("highlighted_candidates")
          .insert([{ employer_id: userId, candidate_id: candidateId }]);

        if (error) throw error;
        setHighlightedMap((prev) => ({ ...prev, [candidateId]: true }));
        toast.success("Candidate highlighted successfully!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update highlight.");
    } finally {
      setBusyCandidateId(null);
    }
  };

  const handleRequestCV = async (candidateId: string) => {
    try {
      setBusyCandidateId(candidateId);
      const { error } = await supabase
        .from("cv_requests")
        .insert([
          {
            employer_id: userId,
            candidate_id: candidateId,
            status: "pending",
          },
        ]);

      if (error) throw error;

      setRequestedMap((prev) => ({ ...prev, [candidateId]: "pending" }));
      toast.success("CV request sent to candidate!");

      // Add a notification for the candidate
      await supabase.from("notifications").insert([
        {
          user_id: candidateId,
          title: "CV Request Received",
          body: "An employer has requested to view your CV. Go to your documents to accept or decline.",
          type: "cv_request",
        },
      ]);

    } catch (err: any) {
      toast.error(err.message || "Failed to send CV request.");
    } finally {
      setBusyCandidateId(null);
    }
  };

  const handleDownloadCV = async (cvPath: string | null) => {
    if (!cvPath) {
      toast.error("Candidate has not shared their CV yet.");
      return;
    }
    try {
      const { data, error } = await supabase.storage.from("cvs").createSignedUrl(cvPath, 60);
      if (error || !data) throw error || new Error("Failed to sign URL");

      window.open(data.signedUrl, "_blank");
    } catch (err: any) {
      toast.error("Could not download CV.");
    }
  };

  // Perform client-side filter for candidates tab
  const getFilteredCandidates = () => {
    return candidates.filter((c) => {
      // 1. Search Query
      const matchesSearch =
        !searchQuery ||
        (c.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.current_job_title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.career_summary || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.skills || []).some((s: string) => s.toLowerCase().includes(searchQuery.toLowerCase()));

      // 2. Experience Filter
      let matchesExp = true;
      if (expFilter !== "all") {
        const exp = c.years_experience || 0;
        if (expFilter === "0-2") matchesExp = exp <= 2;
        else if (expFilter === "3-5") matchesExp = exp >= 3 && exp <= 5;
        else if (expFilter === "5+") matchesExp = exp >= 5;
      }

      // 3. Qualification Filter
      let matchesQual = true;
      if (qualFilter !== "all") {
        matchesQual = (c.highest_education || "").toLowerCase().includes(qualFilter.toLowerCase());
      }

      return matchesSearch && matchesExp && matchesQual;
    });
  };

  const filteredCandidates = getFilteredCandidates();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Talent Search</h1>
        <p className="text-muted-foreground mt-1">
          Explore and highlight active candidates in the platform talent pool.
        </p>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-white/5 gap-6">
        <button
          onClick={() => setActiveSubTab("search")}
          className={`pb-3 font-semibold text-sm transition-all border-b-2 ${
            activeSubTab === "search"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-white"
          }`}
        >
          Search Talent Pool
        </button>
        <button
          onClick={() => setActiveSubTab("highlights")}
          className={`pb-3 font-semibold text-sm transition-all border-b-2 ${
            activeSubTab === "highlights"
              ? "border-transparent text-muted-foreground hover:text-white"
              : "border-transparent text-muted-foreground hover:text-white"
          } ${activeSubTab === "highlights" ? "border-primary text-primary" : ""}`}
        >
          My Highlights ({Object.values(highlightedMap).filter(Boolean).length})
        </button>
        <button
          onClick={() => setActiveSubTab("requests")}
          className={`pb-3 font-semibold text-sm transition-all border-b-2 ${
            activeSubTab === "requests"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-white"
          }`}
        >
          Sent CV Requests
        </button>
      </div>

      {/* Main Search Panel */}
      {activeSubTab === "search" && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-4 gap-4 shadow-xl">
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by keywords, skills, roles..."
                className="pl-10 h-10 rounded-xl bg-card border-white/10 text-white w-full"
              />
            </div>
            <div>
              <Select value={expFilter} onValueChange={setExpFilter}>
                <SelectTrigger className="bg-card border-white/10 text-white rounded-xl h-10">
                  <SelectValue placeholder="Years Experience" />
                </SelectTrigger>
                <SelectContent className="bg-[#0d1117] border-white/5 text-white">
                  <SelectItem value="all" className="hover:bg-white/5 cursor-pointer">Any Experience</SelectItem>
                  <SelectItem value="0-2" className="hover:bg-white/5 cursor-pointer">0 - 2 years</SelectItem>
                  <SelectItem value="3-5" className="hover:bg-white/5 cursor-pointer">3 - 5 years</SelectItem>
                  <SelectItem value="5+" className="hover:bg-white/5 cursor-pointer">5+ years</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={qualFilter} onValueChange={setQualFilter}>
                <SelectTrigger className="bg-card border-white/10 text-white rounded-xl h-10">
                  <SelectValue placeholder="Qualification" />
                </SelectTrigger>
                <SelectContent className="bg-[#0d1117] border-white/5 text-white">
                  <SelectItem value="all" className="hover:bg-white/5 cursor-pointer">Any Qualification</SelectItem>
                  <SelectItem value="bachelor" className="hover:bg-white/5 cursor-pointer">Bachelor's Degree</SelectItem>
                  <SelectItem value="master" className="hover:bg-white/5 cursor-pointer">Master's Degree</SelectItem>
                  <SelectItem value="diploma" className="hover:bg-white/5 cursor-pointer">Diploma</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results Grid */}
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-48 bg-white/5 rounded-2xl" />
              ))}
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="p-12 text-center bg-[#0d1117] border border-white/5 rounded-2xl text-muted-foreground shadow-xl">
              <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-1">No Matching Candidates</h3>
              <p className="text-sm text-muted-foreground">Try broadening your search keywords or filter settings.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredCandidates.map((c) => {
                // Mask Name
                const parts = (c.full_name || "Unknown Candidate").split(" ");
                const firstName = parts[0];
                const lastInitial = parts.length > 1 ? `${parts[parts.length - 1][0]}.` : "";
                const maskedName = `${firstName} ${lastInitial}`;

                const isHighlighted = !!highlightedMap[c.id];
                const requestStatus = requestedMap[c.id];

                return (
                  <div
                    key={c.id}
                    className="bg-[#0d1117] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors flex flex-col gap-4 shadow-xl"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-base font-bold text-white">{maskedName}</h3>
                        <p className="text-xs text-primary font-medium">{c.current_job_title || "Professional"}</p>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded px-2.5 py-1 text-xs text-muted-foreground font-semibold shrink-0">
                        {c.years_experience ? `${c.years_experience} yrs exp` : "Exp not set"}
                      </div>
                    </div>

                    <p className="text-xs text-white/70 line-clamp-3 leading-relaxed">
                      {c.career_summary || "No career summary available."}
                    </p>

                    {/* Candidate Skills */}
                    <div className="flex flex-wrap gap-1.5">
                      {c.skills && c.skills.length > 0 ? (
                        c.skills.slice(0, 5).map((skill: string, index: number) => (
                          <span key={index} className="text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/70">
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-muted-foreground/60 italic">No skills listed</span>
                      )}
                      {c.skills && c.skills.length > 5 && (
                        <span className="text-[9px] text-muted-foreground/70">+{c.skills.length - 5} more</span>
                      )}
                    </div>

                    <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between gap-4">
                      <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[150px]">
                        {c.highest_education || "Qualification N/A"}
                      </span>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          onClick={() => handleToggleHighlight(c.id)}
                          disabled={busyCandidateId === c.id}
                          variant="outline"
                          size="sm"
                          className={`h-8 text-xs rounded-xl flex items-center gap-1 border-white/10 bg-transparent ${
                            isHighlighted ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10" : "text-white hover:bg-white/5"
                          }`}
                        >
                          {isHighlighted ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                          {isHighlighted ? "Starred" : "Star"}
                        </Button>
                        
                        {requestStatus ? (
                          <span className={`h-8 px-3 rounded-xl border flex items-center justify-center text-xs font-semibold ${
                            requestStatus === "sent" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                            requestStatus === "declined" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                            "bg-orange-500/10 text-orange-400 border-orange-500/20"
                          }`}>
                            {requestStatus === "sent" ? "Shared" : requestStatus === "declined" ? "Declined" : "Pending CV"}
                          </span>
                        ) : (
                          <Button
                            onClick={() => handleRequestCV(c.id)}
                            disabled={busyCandidateId === c.id}
                            size="sm"
                            className="h-8 text-xs bg-primary hover:bg-primary/95 text-primary-foreground rounded-xl flex items-center gap-1"
                          >
                            {busyCandidateId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            Reach Out
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Highlights Sub-Panel */}
      {activeSubTab === "highlights" && (
        <div className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-pulse">
              {[1, 2].map((i) => (
                <div key={i} className="h-44 bg-white/5 rounded-2xl" />
              ))}
            </div>
          ) : highlights.length === 0 ? (
            <div className="p-12 text-center bg-[#0d1117] border border-white/5 rounded-2xl text-muted-foreground shadow-xl">
              <Bookmark className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-1">No Starred Candidates</h3>
              <p className="text-sm text-muted-foreground">Bookmark top profiles to see them grouped here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {highlights.map((h) => {
                const c = h.profiles;
                if (!c) return null;

                const parts = (c.full_name || "Unknown Candidate").split(" ");
                const firstName = parts[0];
                const lastInitial = parts.length > 1 ? `${parts[parts.length - 1][0]}.` : "";
                const displayName = `${firstName} ${lastInitial}`;

                const requestStatus = requestedMap[c.id];

                return (
                  <div
                    key={h.id}
                    className="bg-[#0d1117] border border-white/5 rounded-2xl p-5 flex flex-col gap-4 shadow-xl"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-base font-bold text-white">{displayName}</h3>
                        <p className="text-xs text-primary font-medium">{c.current_job_title || "Professional"}</p>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-muted-foreground font-semibold">
                        {c.years_experience ? `${c.years_experience} yrs exp` : "Exp not set"}
                      </div>
                    </div>

                    <p className="text-xs text-white/70 line-clamp-2 leading-relaxed">
                      {c.career_summary || "No career summary available."}
                    </p>

                    <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between gap-4">
                      <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[150px]">
                        {c.highest_education || "Qualification N/A"}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleToggleHighlight(c.id)}
                          disabled={busyCandidateId === c.id}
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs rounded-xl flex items-center gap-1 border-white/10 bg-transparent text-yellow-400 border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10"
                        >
                          <BookmarkCheck className="w-3.5 h-3.5" /> Starred
                        </Button>
                        
                        {requestStatus ? (
                          <span className={`h-8 px-3 rounded-xl border flex items-center justify-center text-xs font-semibold ${
                            requestStatus === "sent" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                            requestStatus === "declined" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                            "bg-orange-500/10 text-orange-400 border-orange-500/20"
                          }`}>
                            {requestStatus === "sent" ? "Shared" : requestStatus === "declined" ? "Declined" : "Pending CV"}
                          </span>
                        ) : (
                          <Button
                            onClick={() => handleRequestCV(c.id)}
                            disabled={busyCandidateId === c.id}
                            size="sm"
                            className="h-8 text-xs bg-primary hover:bg-primary/95 text-primary-foreground rounded-xl flex items-center gap-1"
                          >
                            Reach Out
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Requests Sub-Panel */}
      {activeSubTab === "requests" && (
        <div className="space-y-6">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-white/5 rounded-xl" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center bg-[#0d1117] border border-white/5 rounded-2xl text-muted-foreground shadow-xl">
              <Send className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-1">No CV Requests Sent</h3>
              <p className="text-sm text-muted-foreground">Candidates you reached out to will appear here.</p>
            </div>
          ) : (
            <div className="bg-[#0d1117] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-xs font-semibold text-muted-foreground uppercase bg-white/[0.02]">
                      <th className="px-6 py-4">Candidate</th>
                      <th className="px-6 py-4">Role / Title</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Date Sent</th>
                      <th className="px-6 py-4 text-right">CV Doc</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {requests.map((r) => {
                      const c = r.profiles;
                      if (!c) return null;

                      const parts = (c.full_name || "Unknown Candidate").split(" ");
                      const firstName = parts[0];
                      const lastInitial = parts.length > 1 ? `${parts[parts.length - 1][0]}.` : "";
                      const displayName = `${firstName} ${lastInitial}`;

                      return (
                        <tr key={r.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-white">{displayName}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{c.highest_education || "N/A"}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-white/85">
                            {c.current_job_title || "Professional"}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                              r.status === "sent" ? "bg-green-500/20 text-green-400 border border-green-500/20" :
                              r.status === "declined" ? "bg-red-500/20 text-red-400 border border-red-500/20" :
                              "bg-orange-500/20 text-orange-400 border border-orange-500/20"
                            }`}>
                              {r.status === "sent" ? "Shared / Accepted" : r.status === "declined" ? "Declined" : "Pending Candidate"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-white/80">
                            {new Date(r.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {r.status === "sent" && r.cv_path ? (
                              <Button
                                onClick={() => handleDownloadCV(r.cv_path)}
                                size="sm"
                                variant="outline"
                                className="h-8 border-white/10 hover:bg-white/5 text-xs text-white rounded-xl flex items-center gap-1.5 ml-auto"
                              >
                                <Download className="w-3.5 h-3.5" /> Download CV
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground/50 italic">Unavailable</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
