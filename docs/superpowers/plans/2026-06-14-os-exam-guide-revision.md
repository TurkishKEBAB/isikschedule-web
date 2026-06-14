# Operating Systems Exam Guide Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a UTF-8 Turkish study guide that covers every numbered subsection in Chapters 1-8 of *Operating System Concepts, 9th Edition* while remaining approachable and exam-oriented.

**Architecture:** Use the textbook table of contents as a coverage contract and rewrite the guide with a consistent two-pass chapter template. Keep the final artifact self-contained in the existing download directory, use locally stored and attributed reusable images where they add value, and use Mermaid for original explanatory diagrams.

**Tech Stack:** Markdown, Mermaid, PowerShell, Python 3 with `pypdf`, Wikimedia Commons and official educational sources.

---

## File Map

- Modify: `C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\OS-Sinav-Rehberi.md`
  - Final study guide, source list, chapter questions, answers, and coverage appendix.
- Create: `C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\OS-Sinav-Rehberi.before-codex.md`
  - Exact UTF-8 backup of the pre-revision guide.
- Modify: `C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\images\`
  - Local copies of selected reusable external visuals.
- Create: `C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\images\SOURCES.md`
  - Source URL, creator, license, retrieval date, and usage location for each external visual.
- Reference: `C:\Users\Yigit\Downloads\Operating System Concepts 9th Edition.pdf`
  - Coverage authority for Chapters 1-8.

### Task 1: Preserve The Original And Establish The Coverage Contract

**Files:**
- Create: `C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\OS-Sinav-Rehberi.before-codex.md`
- Modify: `C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\OS-Sinav-Rehberi.md`

- [ ] **Step 1: Create an exact backup**

Run:

```powershell
Copy-Item -LiteralPath 'C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\OS-Sinav-Rehberi.md' `
  -Destination 'C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\OS-Sinav-Rehberi.before-codex.md'
```

Expected: both files exist and have the same SHA-256 hash.

- [ ] **Step 2: Verify the backup**

Run:

```powershell
Get-FileHash 'C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\OS-Sinav-Rehberi.md'
Get-FileHash 'C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\OS-Sinav-Rehberi.before-codex.md'
```

Expected: identical hashes.

- [ ] **Step 3: Add a final coverage appendix structure**

The final document must include a `## İlk 8 Chapter Kapsam Kontrolü` appendix with one row for each of these subsection groups:

```text
Chapter 1: 1.1-1.12
Chapter 2: 2.1-2.10
Chapter 3: 3.1-3.6
Chapter 4: 4.1-4.7
Chapter 5: 5.1-5.10
Chapter 6: 6.1-6.8
Chapter 7: 7.1-7.7
Chapter 8: 8.1-8.8
```

Each row must contain the textbook subsection, the corresponding guide
heading, and a depth marker: `Kısa`, `Orta`, or `Ayrıntılı`.

### Task 2: Research And Attribute Visuals

**Files:**
- Create: `C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\images\SOURCES.md`
- Modify: `C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\images\`

- [ ] **Step 1: Search for reusable visuals**

Search reputable sources for visuals that clarify:

```text
computer system architecture
operating system kernel user space
multicore processor
thread mapping
memory paging and page table
```

Prefer Wikimedia Commons files with explicit Creative Commons or public-domain
licenses and official educational diagrams. Do not use an image whose reuse
terms cannot be identified.

- [ ] **Step 2: Record each selected source before downloading**

Use this exact entry format in `images\SOURCES.md`:

```markdown
## <local filename>

- Konu: <guide concept>
- Kaynak sayfası: <canonical page URL>
- Doğrudan dosya: <download URL>
- Üretici: <creator or organization>
- Lisans: <license name and version>
- Erişim tarihi: 2026-06-14
- Kullanıldığı bölüm: <chapter and heading>
```

- [ ] **Step 3: Download only selected visuals**

Use descriptive ASCII filenames such as:

```text
computer-system-architecture.png
kernel-user-space.svg
multicore-architecture.svg
paging-address-translation.svg
```

Expected: every newly downloaded file has a matching `SOURCES.md` entry.

- [ ] **Step 4: Replace unsuitable visuals with Mermaid**

Use Mermaid rather than external images for:

```text
dual-mode transition
interrupt/system-call flow
OS structure comparison
process states
context switch
IPC models
thread mapping models
critical-section entry
semaphore bounded buffer
scheduling timelines
deadlock handling decision tree
resource-allocation graph
logical-to-physical address flow
```

This keeps the most exam-relevant diagrams original, editable, and readable.

### Task 3: Rewrite The Document Framework

**Files:**
- Modify: `C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\OS-Sinav-Rehberi.md`

- [ ] **Step 1: Replace the opening**

The opening must contain:

```markdown
# İşletim Sistemleri Sınav Çalışma Rehberi

Bu rehber, Operating System Concepts 9th Edition kitabının ilk sekiz
chapter'ını öğrenmek ve sınava hazırlanmak için hazırlanmıştır.

## Nasıl kullanılmalı?
1. Önce bölüm başındaki terimleri oku.
2. Büyük resim şemasını incele.
3. Konu anlatımını sırayla çalış.
4. Sık karıştırılan kavramları karşılaştır.
5. Soruları notlara bakmadan cevapla.
```

Do not include decorative emoji or unsupported claims about exact exam
frequency.

- [ ] **Step 2: Apply the chapter template**

Every chapter must contain these headings:

```markdown
## Chapter N - English Title (Türkçe Başlık)
### Bu bölümde öğreneceğin terimler
### Büyük resim
### Konu anlatımı
### Sık karıştırılan kavramlar
### Kendini dene
### Kısa cevaplar
```

Additional topic headings belong under `### Konu anlatımı` as level-four
headings.

- [ ] **Step 3: Add source and coverage appendices**

The final headings must include:

```markdown
## Karma Mini Sınav
## Karma Mini Sınav Cevapları
## İlk 8 Chapter Kapsam Kontrolü
## Görsel ve Ek Kaynaklar
## Son Tekrar Sayfası
```

### Task 4: Rewrite Chapters 1 And 2

**Files:**
- Modify: `C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\OS-Sinav-Rehberi.md`

- [ ] **Step 1: Cover Chapter 1 completely**

Include all of:

```text
1.1 What Operating Systems Do
1.2 Computer-System Organization
1.3 Computer-System Architecture
1.4 Operating-System Structure
1.5 Operating-System Operations
1.6 Process Management
1.7 Memory Management
1.8 Storage Management
1.9 Protection and Security
1.10 Kernel Data Structures
1.11 Computing Environments
1.12 Open-Source Operating Systems
```

Give `interrupt`, storage hierarchy, multiprogramming, multitasking, dual mode,
timer, and OS roles medium or detailed treatment. Summarize data structures,
computing environments, and open-source systems at introductory depth.

- [ ] **Step 2: Cover Chapter 2 completely**

Include all of:

```text
2.1 Operating-System Services
2.2 User and Operating-System Interface
2.3 System Calls
2.4 Types of System Calls
2.5 System Programs
2.6 Operating-System Design and Implementation
2.7 Operating-System Structure
2.8 Operating-System Debugging
2.9 Operating-System Generation
2.10 System Boot
```

Give system calls, API distinction, policy/mechanism, and structural models
detailed treatment. Explain debugging, system generation, and booting briefly
and concretely.

- [ ] **Step 3: Add questions**

Add 8-12 low-to-medium questions per chapter. At least two questions in each
chapter must ask the reader to distinguish neighboring terms.

### Task 5: Rewrite Chapters 3 And 4

**Files:**
- Modify: `C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\OS-Sinav-Rehberi.md`

- [ ] **Step 1: Cover Chapter 3 completely**

Include:

```text
3.1 Process Concept
3.2 Process Scheduling
3.3 Operations on Processes
3.4 Interprocess Communication
3.5 Examples of IPC Systems
3.6 Communication in Client-Server Systems
```

Give process state, PCB, queues, schedulers, context switch, process creation
and termination, shared memory, message passing, pipes, sockets, and RPC clear
examples.

- [ ] **Step 2: Cover Chapter 4 completely**

Include:

```text
4.1 Overview
4.2 Multicore Programming
4.3 Multithreading Models
4.4 Thread Libraries
4.5 Implicit Threading
4.6 Threading Issues
4.7 Operating-System Examples
```

Define concurrency versus parallelism, Amdahl's Law, user/kernel threads,
thread pools, OpenMP/Grand Central Dispatch at summary depth, fork/exec and
signal issues, thread cancellation, thread-local storage, and Linux/Windows
examples.

- [ ] **Step 3: Add questions**

Use conceptual questions and one simple Amdahl example. Preserve the useful
`start()` versus `run()` versus `join()` explanation as an applied example,
while making clear that it is a Java example rather than the chapter's entire
thread model.

### Task 6: Rewrite Chapters 5 And 6

**Files:**
- Modify: `C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\OS-Sinav-Rehberi.md`

- [ ] **Step 1: Cover Chapter 5 completely**

Include:

```text
5.1 Background
5.2 The Critical-Section Problem
5.3 Peterson's Solution
5.4 Synchronization Hardware
5.5 Mutex Locks
5.6 Semaphores
5.7 Classic Problems of Synchronization
5.8 Monitors
5.9 Synchronization Examples
5.10 Alternative Approaches
```

Teach race conditions, critical-section requirements, mutexes, semaphores,
bounded buffer, readers-writers, dining philosophers, and monitors in detail.
Present Peterson, hardware instructions, OS examples, transactional memory,
and OpenMP as conceptual summaries.

- [ ] **Step 2: Cover Chapter 6 completely**

Include:

```text
6.1 Basic Concepts
6.2 Scheduling Criteria
6.3 Scheduling Algorithms
6.4 Thread Scheduling
6.5 Multiple-Processor Scheduling
6.6 Real-Time CPU Scheduling
6.7 Operating-System Examples
6.8 Algorithm Evaluation
```

Give FCFS, SJF/SRTF, priority, round robin, multilevel queue, and multilevel
feedback queue concrete examples. Summarize thread contention scope,
processor affinity, load balancing, real-time priorities, Linux/Windows
schedulers, deterministic modeling, queueing models, simulation, and
implementation testing.

- [ ] **Step 3: Add calculations sparingly**

Include one shared process set used to compare FCFS, SJF, and RR. Show Gantt
charts and waiting-time calculations without adding advanced proof questions.

### Task 7: Rewrite Chapters 7 And 8

**Files:**
- Modify: `C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\OS-Sinav-Rehberi.md`

- [ ] **Step 1: Cover Chapter 7 completely**

Include:

```text
7.1 System Model
7.2 Deadlock Characterization
7.3 Methods for Handling Deadlocks
7.4 Deadlock Prevention
7.5 Deadlock Avoidance
7.6 Deadlock Detection
7.7 Recovery from Deadlock
```

Give the four necessary conditions, resource-allocation graphs, safe versus
unsafe states, and Banker's algorithm detailed treatment. Keep detection and
recovery examples small enough to solve by hand.

- [ ] **Step 2: Cover Chapter 8 completely**

Include:

```text
8.1 Background
8.2 Swapping
8.3 Contiguous Memory Allocation
8.4 Segmentation
8.5 Paging
8.6 Structure of the Page Table
8.7 Example: Intel 32 and 64-bit Architectures
8.8 Example: ARM Architecture
```

Give address binding, MMU, fragmentation, segmentation, paging, page tables,
and TLB detailed treatment. Summarize hierarchical/hashed/inverted tables and
Intel/ARM architecture examples without drifting into Chapter 9 demand paging
or page replacement.

- [ ] **Step 3: Add calculations sparingly**

Include one address-translation example and one small fragmentation or
allocation example. Clearly label virtual-memory topics that belong to
Chapter 9 as out of scope.

### Task 8: Add Review Material And Source Lists

**Files:**
- Modify: `C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\OS-Sinav-Rehberi.md`
- Modify: `C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\images\SOURCES.md`

- [ ] **Step 1: Add a mixed mini exam**

Create 24 questions:

```text
16 definition or distinction questions
4 short scenario questions
4 simple calculation or diagram questions
```

Provide compact answers in a separate section after all questions.

- [ ] **Step 2: Complete the coverage appendix**

Every subsection from 1.1 through 8.8 must map to an exact guide heading and
depth. No row may say only `chapter summary`.

- [ ] **Step 3: Add visual and supplemental sources**

Link the textbook bibliographic entry, Mermaid documentation, and each external
visual's canonical source page. Keep image license details in `images\SOURCES.md`.

- [ ] **Step 4: Add the final review sheet**

Limit this section to the concepts most useful for a 10-minute review. It must
include definitions and distinctions, not motivational language or emoji.

### Task 9: Verify The Final Artifact

**Files:**
- Verify: `C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\OS-Sinav-Rehberi.md`
- Verify: `C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\images\SOURCES.md`

- [ ] **Step 1: Verify UTF-8 and required headings**

Run:

```powershell
$p = 'C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\OS-Sinav-Rehberi.md'
$text = Get-Content -Raw -Encoding UTF8 $p
$required = @(
  'Bu bölümde öğreneceğin terimler',
  'Büyük resim',
  'Kendini dene',
  'Kısa cevaplar',
  'İlk 8 Chapter Kapsam Kontrolü',
  'Görsel ve Ek Kaynaklar'
)
$required | ForEach-Object {
  if (-not $text.Contains($_)) { throw "Eksik başlık: $_" }
}
```

Expected: no exception.

- [ ] **Step 2: Verify all numbered subsections**

Run a check that searches the coverage appendix for:

```text
1.1-1.12, 2.1-2.10, 3.1-3.6, 4.1-4.7,
5.1-5.10, 6.1-6.8, 7.1-7.7, 8.1-8.8
```

Expected: 68 distinct subsection identifiers and no missing identifier.

- [ ] **Step 3: Verify local image links**

Run:

```powershell
$base = 'C:\Users\Yigit\Downloads\OS-Calisma-Rehberi'
$text = Get-Content -Raw -Encoding UTF8 (Join-Path $base 'OS-Sinav-Rehberi.md')
[regex]::Matches($text, '!\[[^\]]*\]\(([^)]+)\)') | ForEach-Object {
  $target = Join-Path $base $_.Groups[1].Value
  if (-not (Test-Path -LiteralPath $target)) { throw "Bozuk görsel: $target" }
}
```

Expected: no exception.

- [ ] **Step 4: Verify emoji removal**

Run:

```powershell
$text = Get-Content -Raw -Encoding UTF8 `
  'C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\OS-Sinav-Rehberi.md'
$emojiCount = [regex]::Matches(
  $text,
  '[\u2600-\u27BF]|[\uD83C-\uDBFF][\uDC00-\uDFFF]'
).Count
if ($emojiCount -ne 0) { throw "Kalan emoji/süs sembolü: $emojiCount" }
```

Expected: zero.

- [ ] **Step 5: Verify Mermaid fences**

Run:

```powershell
$text = Get-Content -Raw -Encoding UTF8 `
  'C:\Users\Yigit\Downloads\OS-Calisma-Rehberi\OS-Sinav-Rehberi.md'
$open = ([regex]::Matches($text, '```mermaid')).Count
$allFences = ([regex]::Matches($text, '(?m)^```')).Count
if ($allFences % 2 -ne 0) { throw 'Eşleşmeyen code fence var' }
"Mermaid blocks: $open"
```

Expected: an even total fence count and at least eight Mermaid diagrams.

- [ ] **Step 6: Perform a final manual audit**

Confirm:

```text
No Chapter 9 page-replacement algorithms are taught as Chapter 8 content.
Every external image has a source and license.
Each chapter defines terms before using them.
Questions are mostly definitional or conceptual.
Answers do not contradict the explanatory text.
The backup file remains unchanged.
```
