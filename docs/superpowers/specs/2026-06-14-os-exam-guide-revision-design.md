# Operating Systems Exam Guide Revision Design

## Goal

Revise `C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\OS-Sinav-Rehberi.md`
into a self-contained Turkish study guide for Chapters 1-8 of *Operating
System Concepts, 9th Edition*.

The guide must cover every textbook subsection at least briefly while giving
more space to likely exam topics. It should teach concepts from first
principles, avoid unnecessary technical depth, and support both initial
learning and later review.

## Audience And Difficulty

- The reader is learning the material rather than using the document only as
  a last-minute summary.
- Explanations are in Turkish. Important technical terms retain their English
  names in backticks.
- Questions focus mainly on definitions, distinctions, short explanations,
  and simple applications.
- Calculation questions are limited to core examples such as scheduling,
  Banker's algorithm, semaphores, and paging address translation.
- Architecture-specific details and advanced algorithms are summarized rather
  than taught at implementation depth unless they clarify a core concept.

## Chapter Structure

Each of the eight chapters follows the same two-pass learning structure:

1. `Bu bölümde öğreneceğin terimler`: short first definitions of essential
   vocabulary.
2. `Büyük resim`: a short mental model supported by one overview diagram when
   useful.
3. `Konu anlatımı`: every textbook subsection is represented. Important
   concepts receive examples and fuller explanations.
4. Contextual repetition: important terms are defined again where they become
   operationally relevant, usually with an example or contrast.
5. `Sık karıştırılanlar`: concise comparisons of neighboring concepts.
6. `Kendini dene`: low-to-medium difficulty questions.
7. `Kısa cevaplar`: compact answers suitable for self-checking.

The document ends with a mixed mini exam and a compact final review sheet.

## Coverage Standard

The textbook table of contents is the coverage authority.

- Every numbered subsection in Chapters 1-8 must map to at least one clearly
  labeled passage in the guide.
- Exam-relevant concepts already present in the guide remain, but unsupported
  claims about exact past-exam frequency are removed unless a source is
  available.
- Chapter summaries do not count as coverage of omitted subsections.
- Chapters 1, 4, 6, and 8 require particular expansion because the current
  guide omits several listed subsections.
- A final appendix records a subsection-by-subsection coverage checklist.

## Visual Strategy

Use visuals only when they reduce cognitive load.

1. Prefer diagrams from reputable educational or official sources when the
   license and source can be identified.
2. Store downloaded assets locally under the guide's `images/` directory so
   the Markdown remains usable offline.
3. Add a short caption and a source link for each external visual.
4. Use Mermaid for process flows, state changes, comparisons, or algorithms
   when a suitable reusable external image is unavailable.
5. Do not retain unattributed textbook screenshots as if they were internet
   resources. Replace them with original Mermaid diagrams or clearly identify
   them as figures extracted from the user-provided textbook.

Likely diagram subjects:

- user mode and kernel mode transitions
- interrupt and system-call flow
- operating-system structures
- process states and context switching
- IPC models
- thread mappings
- critical-section and semaphore flow
- scheduling timelines
- resource-allocation graphs and deadlock handling
- paging, TLB, segmentation, and address translation

## Writing Rules

- Remove decorative emojis.
- Use direct, explanatory Turkish and short paragraphs.
- Define a term before relying on it.
- Repeat foundational definitions when they reappear in a new context.
- Use tables for comparisons, not for long prose.
- Use examples that require little programming background.
- Preserve conventional field names and formulas accurately.
- Avoid saying that a simplified analogy is the complete technical
  definition.
- Use UTF-8 and verify Turkish characters after writing.

## Source And Citation Rules

- The user-provided PDF is the primary coverage source.
- External technical claims should use reputable primary or educational
  sources.
- External images must have a source URL and identifiable reuse terms.
- A `Görsel ve ek kaynaklar` section lists all external visual sources.
- The revised guide paraphrases the textbook and does not reproduce long
  passages.

## Verification

Completion requires all of the following:

- all Chapter 1-8 numbered subsections appear in the coverage appendix
- no decorative emoji remains
- all local image links resolve
- all external visual sources are listed
- every Mermaid block has matching fences and supported syntax
- Turkish text opens correctly as UTF-8
- each chapter contains terms, overview, content, confusion checks, questions,
  and answers
- question difficulty remains mostly definitional and conceptual
- the final file is reviewed for contradictions and accidental Chapter 9+
  material

## Non-Goals

- Reproducing the textbook line by line
- Covering Chapters 9-20
- Creating a highly technical operating-systems reference manual
- Predicting the instructor's exact exam questions
- Replacing the source textbook for architecture-specific implementation
  details
