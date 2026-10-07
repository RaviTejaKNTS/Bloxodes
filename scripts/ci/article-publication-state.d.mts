export type PublicationRun = {id:number;display_title:string;event:string;head_branch:string;created_at:string;status:string;conclusion?:string|null;html_url:string};
export function matchingArticleRun(runs:PublicationRun[],intent:{dispatchHash?:string;submittedAt?:string;githubRunId?:number}):PublicationRun|null;
export function articleRunOutcome(run:PublicationRun|null):'pending'|'receipt-needed'|'retry';
