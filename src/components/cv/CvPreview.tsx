import type { CvData, CvTemplate } from "@/types/cv";

interface Props {
  data: CvData;
  template: CvTemplate;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="cv-section">
    <h2 className="cv-section-title">{title}</h2>
    {children}
  </section>
);

const Tags = ({ items }: { items: string[] }) =>
  items.length === 0 ? null : (
    <div className="cv-tags">
      {items.map((s, i) => (
        <span key={i} className="cv-tag">{s}</span>
      ))}
    </div>
  );

const Body = ({ data }: { data: CvData }) => (
  <>
    {data.summary && (
      <Section title="Shrnutí">
        <p className="cv-paragraph">{data.summary}</p>
      </Section>
    )}
    {data.work_experience.length > 0 && (
      <Section title="Pracovní zkušenosti">
        {data.work_experience.map((w, i) => (
          <div key={i} className="cv-entry">
            <div className="cv-entry-head">
              <strong>{w.position || "Pozice"}</strong>
              {w.company && <span> · {w.company}</span>}
              {w.period && <span className="cv-period"> · {w.period}</span>}
            </div>
            {w.description && <p className="cv-paragraph">{w.description}</p>}
          </div>
        ))}
      </Section>
    )}
    {data.education.length > 0 && (
      <Section title="Vzdělání">
        {data.education.map((e, i) => (
          <div key={i} className="cv-entry">
            <div className="cv-entry-head">
              <strong>{e.degree || e.school}</strong>
              {e.school && e.degree && <span> · {e.school}</span>}
              {e.period && <span className="cv-period"> · {e.period}</span>}
            </div>
            {e.description && <p className="cv-paragraph">{e.description}</p>}
          </div>
        ))}
      </Section>
    )}
    {data.skills.length > 0 && (
      <Section title="Dovednosti"><Tags items={data.skills} /></Section>
    )}
    {data.languages.length > 0 && (
      <Section title="Jazyky"><Tags items={data.languages} /></Section>
    )}
    {data.certifications.length > 0 && (
      <Section title="Certifikace"><Tags items={data.certifications} /></Section>
    )}
  </>
);

const Header = ({ data }: { data: CvData }) => (
  <header className="cv-header">
    <h1 className="cv-name">{data.full_name || "Tvé jméno"}</h1>
    {data.headline && <p className="cv-headline">{data.headline}</p>}
    <div className="cv-contact">
      {data.email && <span>{data.email}</span>}
      {data.phone && <span>{data.phone}</span>}
      {data.location && <span>{data.location}</span>}
    </div>
  </header>
);

const CvPreview = ({ data, template }: Props) => {
  return (
    <div className={`cv-doc cv-${template}`}>
      <Header data={data} />
      <Body data={data} />
    </div>
  );
};

export default CvPreview;