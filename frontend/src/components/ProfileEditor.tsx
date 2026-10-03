import { motion } from "framer-motion";
import { Briefcase, FolderGit2, GraduationCap, Link2, Plus, Trash2, User } from "lucide-react";
import type { ReactNode } from "react";
import type { AttestedSkill, Education, Experience, Profile, Project } from "@/lib/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardTitle } from "./ui/card";
import { Input, Label, Textarea } from "./ui/field";
import { TagInput } from "./TagInput";

const lines = (s: string) => s.split("\n");
const clean = (a: string[]) => a.map((x) => x.trim()).filter(Boolean);

function Section({ icon, title, i, children, action }: { icon: ReactNode; title: string; i: number; children: ReactNode; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 40, scale: 0.94, rotate: i % 2 ? 1.5 : -1.5 }} animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 160, damping: 18, delay: i * 0.08 }}>
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">{icon}{title}</CardTitle>
          {action}
        </div>
        {children}
      </Card>
    </motion.div>
  );
}

const F = ({ label, children }: { label: string; children: ReactNode }) => <div><Label>{label}</Label>{children}</div>;

export function ProfileEditor({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => onChange({ ...profile, [k]: v });
  const upd = <T,>(arr: T[], i: number, patch: Partial<T>) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x));
  const c = profile.contact;
  const rm = <T,>(arr: T[], i: number) => arr.filter((_, j) => j !== i);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Section i={0} icon={<User className="size-4 text-accent" />} title="Contact">
        <div className="grid gap-3 sm:grid-cols-2">
          {(["name", "email", "phone", "location"] as const).map((k) => (
            <F key={k} label={k}><Input value={c[k]} onChange={(e) => set("contact", { ...c, [k]: e.target.value })} /></F>
          ))}
        </div>
        <F label="Links"><TagInput value={c.links} onChange={(links) => set("contact", { ...c, links })} placeholder="linkedin.com/in/you" /></F>
      </Section>

      <Section i={1} icon={<User className="size-4 text-accent" />} title="Summary & skills">
        <F label="Summary"><Textarea value={profile.summary} onChange={(e) => set("summary", e.target.value)} /></F>
        <F label="Skills"><TagInput value={profile.skills} onChange={(v) => set("skills", v)} placeholder="Add a skill" /></F>
      </Section>

      <div className="lg:col-span-2">
        <Section i={2} icon={<Briefcase className="size-4 text-accent" />} title="Experience"
          action={<Button size="sm" variant="glass" onClick={() => set("experience", [...profile.experience, { company: "", title: "", location: "", start: "", end: "", bullets: [] }])}><Plus />Add</Button>}>
          <div className="grid gap-4 xl:grid-cols-2">
            {profile.experience.map((e: Experience, i) => (
              <div key={i} className="space-y-3 rounded-xl border p-4">
                <div className="grid grid-cols-2 gap-3">
                  <F label="Title"><Input value={e.title} onChange={(ev) => set("experience", upd(profile.experience, i, { title: ev.target.value }))} /></F>
                  <F label="Company"><Input value={e.company} onChange={(ev) => set("experience", upd(profile.experience, i, { company: ev.target.value }))} /></F>
                  <F label="Start"><Input value={e.start} onChange={(ev) => set("experience", upd(profile.experience, i, { start: ev.target.value }))} /></F>
                  <F label="End"><Input value={e.end} onChange={(ev) => set("experience", upd(profile.experience, i, { end: ev.target.value }))} /></F>
                </div>
                <F label="Bullets (one per line)"><Textarea rows={4} value={e.bullets.join("\n")} onChange={(ev) => set("experience", upd(profile.experience, i, { bullets: lines(ev.target.value) }))} onBlur={() => set("experience", upd(profile.experience, i, { bullets: clean(e.bullets) }))} /></F>
                <Button size="sm" variant="ghost" onClick={() => set("experience", rm(profile.experience, i))}><Trash2 />Remove</Button>
              </div>
            ))}
            {!profile.experience.length && <p className="text-sm text-muted-foreground">No experience found. Add a role manually.</p>}
          </div>
        </Section>
      </div>

      <Section i={3} icon={<FolderGit2 className="size-4 text-accent" />} title="Projects"
        action={<Button size="sm" variant="glass" onClick={() => set("projects", [...profile.projects, { name: "", description: "", tech: [], bullets: [] }])}><Plus />Add</Button>}>
        {profile.projects.map((p: Project, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-4">
            <F label="Name"><Input value={p.name} onChange={(e) => set("projects", upd(profile.projects, i, { name: e.target.value }))} /></F>
            <F label="Description"><Textarea rows={2} value={p.description} onChange={(e) => set("projects", upd(profile.projects, i, { description: e.target.value }))} /></F>
            <F label="Tech"><TagInput value={p.tech} onChange={(tech) => set("projects", upd(profile.projects, i, { tech }))} /></F>
            <F label="Bullets (one per line)"><Textarea rows={3} value={p.bullets.join("\n")} onChange={(e) => set("projects", upd(profile.projects, i, { bullets: lines(e.target.value) }))} onBlur={() => set("projects", upd(profile.projects, i, { bullets: clean(p.bullets) }))} /></F>
            <Button size="sm" variant="ghost" onClick={() => set("projects", rm(profile.projects, i))}><Trash2 />Remove</Button>
          </div>
        ))}
        {!profile.projects.length && <p className="text-sm text-muted-foreground">No projects.</p>}
      </Section>

      <Section i={4} icon={<GraduationCap className="size-4 text-accent" />} title="Education"
        action={<Button size="sm" variant="glass" onClick={() => set("education", [...profile.education, { school: "", degree: "", field: "", start: "", end: "", details: [] }])}><Plus />Add</Button>}>
        {profile.education.map((e: Education, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-4">
            <div className="grid grid-cols-2 gap-3">
              <F label="School"><Input value={e.school} onChange={(ev) => set("education", upd(profile.education, i, { school: ev.target.value }))} /></F>
              <F label="Degree"><Input value={e.degree} onChange={(ev) => set("education", upd(profile.education, i, { degree: ev.target.value }))} /></F>
              <F label="Field"><Input value={e.field} onChange={(ev) => set("education", upd(profile.education, i, { field: ev.target.value }))} /></F>
              <F label="Years"><Input value={[e.start, e.end].filter(Boolean).join(" – ")} onChange={(ev) => { const [a = "", b = ""] = ev.target.value.split(/\s*[–-]\s*/); set("education", upd(profile.education, i, { start: a, end: b })); }} /></F>
            </div>
            <Button size="sm" variant="ghost" onClick={() => set("education", rm(profile.education, i))}><Trash2 />Remove</Button>
          </div>
        ))}
        {!profile.education.length && <p className="text-sm text-muted-foreground">No education.</p>}
      </Section>

      <Section i={5} icon={<User className="size-4 text-accent" />} title="Certifications">
        <TagInput value={profile.certifications} onChange={(v) => set("certifications", v)} placeholder="Add certification" />
      </Section>
      <Section i={6} icon={<User className="size-4 text-accent" />} title="Publications">
        <TagInput value={profile.publications} onChange={(v) => set("publications", v)} placeholder="Add publication" />
      </Section>

      {(profile.attested_skills ?? []).length > 0 && (
        <div className="lg:col-span-2">
          <Section i={7} icon={<Link2 className="size-4 text-accent" />} title="Added skills (from Match)">
            <p className="text-xs text-muted-foreground">Job skills you approved. Generated documents may claim them, grounded in this evidence.</p>
            {(profile.attested_skills ?? []).map((a: AttestedSkill, i) => (
              <div key={i} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                <F label="Skill"><Input value={a.skill} onChange={(e) => set("attested_skills", upd(profile.attested_skills ?? [], i, { skill: e.target.value }))} /></F>
                <F label="Evidence"><Input value={a.evidence} onChange={(e) => set("attested_skills", upd(profile.attested_skills ?? [], i, { evidence: e.target.value }))} /></F>
                <div className="flex items-center gap-2">
                  {a.self_attested && <Badge tone="warn">Self-attested</Badge>}
                  <Button size="sm" variant="ghost" aria-label={`Remove ${a.skill}`} onClick={() => set("attested_skills", rm(profile.attested_skills ?? [], i))}><Trash2 />Remove</Button>
                </div>
              </div>
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}
