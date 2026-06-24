
import { ChangeDetectorRef, Component, ElementRef, Input, TemplateRef, ViewChild } from '@angular/core';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { KanbanService } from 'src/app/services/apps/kanban/kanban.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { Todos } from 'src/app/pages/apps/kanban/kanban';
import { JobService } from '../job.service';
import { CookieService } from 'ngx-cookie-service';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, NgForm, Validators } from '@angular/forms';
import { EncryptedCookieService } from 'src/app/services/encrypted-cookie.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatNativeDateModule } from '@angular/material/core';
import { InterviewpanelComponent } from '../interviewpanel/interviewpanel.component';
import { AIcalllauncherComponent } from '../AI-Call-Lancher/aicall';
import { error } from 'console';
import { MatSelectChange } from '@angular/material/select';
import { MatChipInputEvent } from '@angular/material/chips';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { ToastrService } from 'ngx-toastr';
import { GroupComponent } from '../../group/group.component';
import { ReactiveFormsModule } from '@angular/forms';
import { GroupService, BroadcastProgressEvent } from '../../group/group.service';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { CallloaderComponent } from '../callloader/callloader.component';

@Component({
  selector: 'karbantrackerjob',
  templateUrl: './karbantrackerjob.component.html',
  styleUrls: ['./karbantrackerjob.component.scss'],
  standalone: true,
  imports: [
    MaterialModule,
    CommonModule,
    TablerIconsModule,
    DragDropModule,
    NgScrollbarModule,
    MatTooltipModule,
    MatButtonModule,
    FormsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatNativeDateModule,
    ReactiveFormsModule,
    CallloaderComponent
  ]
})
export class KarbantrackerjobComponent {
  @ViewChild('dateDialogTemplate') dateDialogTemplate!: TemplateRef<any>;
  dialogRef: MatDialogRef<any> | null = null;
  dialogTitle: string = '';
  selectedDate: Date | null = null;
  @Input() jobId!: string;
  @Input() candidateId!: string;
  droped: any;
  divisionId: string | null;
  accesstype: string | null;
  isDisabled: boolean;
  getStatusValue(stage: string): number {
    switch (stage) {
      case 'Assigned': return 1;
      case 'Shortlisted': return 2;
      case 'Submitted': return 3;
      case 'ScheduledInterview': return 4;
      case 'Placed': return 5;
      case 'Onboarding': return 6;
      case 'Droped': return 8;
      default: return 1;
    }
  }
  private _viewMode: 'kanban' | 'table' = 'kanban';
  get viewMode(): 'kanban' | 'table' {
    return this._viewMode;
  }
  set viewMode(mode: 'kanban' | 'table') {
    this._viewMode = mode;

    if (mode === 'kanban') {
      this.selectedStageFilter = '';
    }
  }
  candidates: any[] = [];
  shortlisted: any[] = [];
  submitted: any[] = [];
  scheduledInterview: any[] = [];
  hrinterview: any[] = [];
  finalinterview: any[] = [];
  offered: any[] = [];
  placed: any[] = [];
  onboarding: any[] = [];
  DocumentsCollecting: any[] = [];
  orgid: any;
  jobDetails: any;
  usermail: string;
  email: any;
  firstName: any;
  lastName: any;
  recruiterid: string | null;
  showStageModal = false;
  selectedCandidateId: number | null = null;
  selectedStage: string | null = null;
  loadingAI = false;
  showModal = false;
  groups: any[] = [];
  selectedGroupCandidates: any[] = [];
  selectAll = false;
  selectedGroup: string = '';
  sending = false;
  progress = { sent: 0, failed: 0, total: 0, percent: 0 };
  logs: { status: 'sent' | 'failed', recipient: string, message?: string }[] = [];
  showCandidateForm = true;
  showEmailForm = false;
  private sub: any | null = null;
  emailForm!: FormGroup;
  readonly separatorKeys = [ENTER, COMMA] as const;
  private emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  data: any;
  selectedJobId: number | null = null;
  isloading: boolean = false;
  candidateIds: number[] = [];
  candidateEmails: string[] = [];
  JobId: any;
  recruiterId: any;
  source: any;


  private readonly STAGE_ACCESS_CODE: Record<string, string> = {
    Assigned: '30201',
    Shortlisted: '30202',
    Submitted: '30203',
    ScheduledInterview: '30204',
    Placed: '30205',
    Onboarding: '30206',
    Droped: '30207',
  };
  private trackerAccess = new Set<string>();

  constructor(
    public dialog: MatDialog,
    public taskService: KanbanService,
    private Service: JobService,
    private snackBar: MatSnackBar,
    private CookieService: CookieService,
    private router: Router,
    private encryptedCookieService: EncryptedCookieService,
    private cdRef: ChangeDetectorRef,
    private location: Location,
    private toastr: ToastrService,
    private GroupService: GroupService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private jobService: JobService,

  ) {
    this.orgid = this.encryptedCookieService.getCookie('orgId');
    this.recruiterid = this.encryptedCookieService.getCookie('userId')
    this.accesstype = this.encryptedCookieService.getCookie('AccessType');
    this.divisionId = this.encryptedCookieService.getCookie('divisionId');
    this.email = this.encryptedCookieService.getCookie('email');
    this.firstName = this.encryptedCookieService.getCookie('firstName');
    this.lastName = this.encryptedCookieService.getCookie('lastName');
    const trackerJson = this.encryptedCookieService.getCookie('trackerAllowedIds') || '[]';

    let trackerAllowedIds: string[] = [];
    try {
      const parsed = JSON.parse(trackerJson);
      trackerAllowedIds = Array.isArray(parsed) ? parsed.map(v => String(v)) : [];
    } catch {
      trackerAllowedIds = [];
    }
    this.trackerAccess = new Set(trackerAllowedIds);
    console.table(
      trackerAllowedIds.map((code, i) => ({ index: i, code }))
    );
    const trackerAllowedAsNumbers = trackerAllowedIds.map(c => Number(c));

    const canUseTracker = (code: string) => trackerAllowedIds.includes(String(code));

  }
  ngOnInit(): void {
    this.initEmailForm();

    this.jobId = this.route.snapshot.paramMap.get('id') || '';

    this.selectedJobId = Number(this.jobId);

    this.data = history.state;
    if (this.data.source === "Group") {
      this.showModal = true;
    }

    this.route.paramMap.subscribe(params => {
      this.JobId = params.get('jobId');
    });
    this.route.queryParams.subscribe(params => {

      this.candidateIds = JSON.parse(
        params['candidateids'] || '[]'
      );

      this.candidateEmails = JSON.parse(
        params['candidateemails'] || '[]'
      );

      this.recruiterId = params['recruiterid'];
      this.source = params['source'];



      if (this.source === 'CandidateMatching') {

        this.showModal = true;
        this.showCandidateForm = false;
        this.showEmailForm = true;

        const visibleTo =
          this.email && this.emailRegex.test(this.email)
            ? [this.email]
            : [];

        const jobTitle =
          this.jobDetails?.title ||
          this.jobDetails?.JobTitle ||
          '';

        const jobDescription =
          this.jobDetails?.jobDescription ||
          this.jobDetails?.JobDescription ||
          '';

        const body = `...`;

        this.emailForm.patchValue({
          to: visibleTo,
          bcc: this.candidateEmails,
          subject: jobTitle ? `Opportunity: ${jobTitle}` : 'Opportunity with our team',
          note: body
        });
      }

    });


    this.getassignedjobs();
    this.getjobdetails();
    this.getGroup();
    this.fetchAiAccess();

    if (this.email && this.emailRegex.test(this.email)) {
      this.emailForm.patchValue({ to: [this.email] });
    }
  }

  private aiButton?: {
    is_active?: boolean;
    daily_reset_enabled?: boolean;
    weekly_reset_enabled?: boolean;
    monthly_reset_enabled?: boolean;
    available_today?: number;
    available_thisweek?: number;
    available_monthly?: number;
  };
  fetchAiAccess(): void {
    const payload = {
      orgId: this.orgid,
      recruiterId: this.recruiterid,
      button_id: 6,
      button_name: 'ai_call_agent_twilio'
    };
    this.Service.GetAIaccess(payload).subscribe({
      next: (res: any) => {
        if (res.ok && res.button) {
          this.aiButton = res.button;
          this.updateButtonState();
        } else {
          this.isDisabled = true;
          this.toastr.error('AI Access unavailable', 'Error');
        }
      },
      error: (err: any) => {
        console.error(' Error fetching AI access:', err);
        this.isDisabled = true;
        this.toastr.error('Unable to check AI quota', 'Error');
      }
    });
  }
  private getNum(v: any, fallback = 0): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  private updateButtonState(): void {
    if (!this.aiButton) {
      this.isDisabled = true;
      return;
    }

    const active = this.aiButton.is_active !== false; // default to true if missing
    const dailyEnabled = !!this.aiButton.daily_reset_enabled;
    const weeklyEnabled = !!this.aiButton.weekly_reset_enabled;
    const monthlyEnabled = !!this.aiButton.monthly_reset_enabled;

    const dailyAvail = this.getNum(this.aiButton.available_today, 0);
    const weeklyAvail = this.getNum(this.aiButton.available_thisweek, 0);
    const monthlyAvail = this.getNum(this.aiButton.available_monthly, 0);

    // Disable if inactive OR any enabled tier is exhausted
    this.isDisabled =
      !active ||
      (dailyEnabled && dailyAvail <= 0) ||
      (weeklyEnabled && weeklyAvail <= 0) ||
      (monthlyEnabled && monthlyAvail <= 0);
  }

  CandidateDetails(candidateId: any) {
    if (candidateId) {
      this.router.navigate(['ats/job/CandidatedetailsComponent', candidateId], { queryParams: { source: '0' } });
    }
  }
  getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    const intervals: any = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
      second: 1
    };
    for (const unit in intervals) {
      const seconds = intervals[unit];
      const count = Math.floor(diffInSeconds / seconds);
      if (count >= 1) {
        return `${count} ${unit}${count > 1 ? 's' : ''} ago`;
      }
    }
    return 'Just now';
  }

  getassignedjobs() {
    this.isloading = true;
    if (!this.jobId) {
      console.error('Job ID is not set.');
      return;
    }
    if (!this.recruiterid || !this.accesstype || !this.divisionId) {
      console.error('recruiterId, accessType, and divisionId are required.');
      return;
    }
    this.Service.getAssignedJobs(
      Number(this.jobId),
      this.orgid,
      this.recruiterid,
      this.accesstype,
      this.divisionId,
      this.candidateId,
    ).subscribe({
      next: (res: any) => {
        this.candidates = res.candidates.filter((c: any) =>
          c.applicants && c.applicants.some((a: any) => a.status === 1)
        );
        this.shortlisted = res.candidates.filter((c: any) =>
          c.applicants && c.applicants.some((a: any) => a.status === 2)
        );
        this.submitted = res.candidates.filter((c: any) =>
          c.applicants && c.applicants.some((a: any) => a.status === 3)
        );
        this.scheduledInterview = res.candidates.filter((c: any) =>
          c.applicants && c.applicants.some((a: any) => a.status === 4)
        );
        this.placed = res.candidates.filter((c: any) =>
          c.applicants && c.applicants.some((a: any) => a.status === 5)
        );
        this.onboarding = res.candidates.filter((c: any) =>
          c.applicants && c.applicants.some((a: any) => a.status === 6)
        );
        this.droped = res.candidates.filter((c: any) =>
          c.applicants && c.applicants.some((a: any) => a.status === 8)
        );
        // Relevancy check for each list
        this.checkRelevancyForKanbanList(this.candidates);
        this.checkRelevancyForKanbanList(this.shortlisted);
        this.checkRelevancyForKanbanList(this.submitted);
        this.checkRelevancyForKanbanList(this.scheduledInterview);
        this.checkRelevancyForKanbanList(this.placed);
        this.checkRelevancyForKanbanList(this.onboarding);
        this.isloading = false;
      },
      error: (err: any) => {
        console.error('Error fetching assigned jobs:', err);
        this.isloading = false;
      }
    });
  }

  get displayedColumns(): string[] {
    const baseColumns = ['sno', 'candidateName', 'currentStage'];
    if (this.selectedStageFilter?.toLowerCase() === 'droped') {
      return [...baseColumns, 'dropReason', 'newColumn', 'view'];
    }
    return [...baseColumns, 'newColumn', 'view'];
  }
  candidateSearchText: string = '';
  selectedStageFilter: string = '';
  allStages: string[] = [
    'Assigned',
    'Shortlisted',
    'Submitted',
    'ScheduledInterview',
    'Placed',
    'Onboarding',
    'Droped'
  ];
  get statuses(): string[] {
    if (this.viewMode === 'kanban') {
      return this.allStages.filter(stage => stage !== 'Droped' && this.canSeeStage(stage));
    }
    return this.allStages.filter(stage => this.canSeeStage(stage));
  }
  matchesSearch = (candidate: any): boolean => {
    const nameMatch = this.candidateSearchText
      ? (
        ((candidate.firstname || '') + ' ' + (candidate.lastname || '')).toLowerCase().includes(this.candidateSearchText.toLowerCase()) ||
        (candidate.email || '').toLowerCase().includes(this.candidateSearchText.toLowerCase()) ||
        (candidate.phonenumber || '').toLowerCase().includes(this.candidateSearchText.toLowerCase())
      )
      : true;
    const stageMatch = this.selectedStageFilter
      ? (candidate.currentStage || '').toLowerCase() === this.selectedStageFilter.toLowerCase()
      : true;
    return nameMatch && stageMatch;
  };
  get allCandidates() {
    const mapWithStage = (arr: any[], stage: string) =>
      arr.map(c => ({
        ...c,
        currentStage: stage,
        dropped: c.dropped || false,
        droppedReason: c.droppedReason || c.dropReason || '',
        updatedBy: c.updatedBy || c.updated_by || '',
        updatedTime: c.updatedTime || c.updated_time || c.updatedAt || c.updated_at || c.modifiedAt || ''
      }));
    return [
      ...mapWithStage(this.candidates, 'Assigned'),
      ...mapWithStage(this.shortlisted, 'Shortlisted'),
      ...mapWithStage(this.submitted, 'Submitted'),
      ...mapWithStage(this.scheduledInterview, 'ScheduledInterview'),
      ...mapWithStage(this.placed, 'Placed'),
      ...mapWithStage(this.onboarding, 'Onboarding'),
      ...mapWithStage(this.droped, 'Droped')
    ]
      .filter(c => this.canSeeStage(c.currentStage))
      .filter(this.matchesSearch);
  }
  // getjobdetails() {
  //   this.isloading = true;
  //   this.jobId = this.jobId;
  //   if (!this.jobId) {
  //     console.error('Job ID is not set.');
  //     return;
  //   }
  //   this.Service.getJobById(Number(this.jobId)).subscribe({
  //     next: (res: any) => {
  //       this.jobDetails = res.data;
  //       this.isloading = false;
  //     },
  //     error: (err: any) => {
  //       console.error('Error fetching job details:', err);
  //       this.isloading = false;
  //     }
  //   });
  // }

  getjobdetails() {
    this.isloading = true;

    this.Service.getJobById(Number(this.jobId)).subscribe({
      next: (res: any) => {

        this.jobDetails = res.data;

        if (this.source === 'CandidateMatching') {

          this.showModal = true;
          this.showCandidateForm = false;
          this.showEmailForm = true;

          const visibleTo =
            this.email && this.emailRegex.test(this.email)
              ? [this.email]
              : [];

          const jobTitle =
            this.jobDetails?.title ||
            this.jobDetails?.JobTitle ||
            '';

          const jobDescription =
            this.jobDetails?.jobDescription ||
            this.jobDetails?.JobDescription ||
            '';

          const body = `Hey Candidate,

We are excited to connect with you regarding a new opportunity that aligns with your skills and career goals.

Title: ${jobTitle}

Job Description: ${jobDescription}

Thank you,
${this.firstName || ''} ${this.lastName || ''}
${this.email || ''}`;

          this.emailForm.patchValue({
            to: visibleTo,
            bcc: [...this.candidateEmails],
            subject: jobTitle
              ? `Opportunity: ${jobTitle}`
              : 'Opportunity with our team',
            note: body
          });

        }

        this.isloading = false;
      },

      error: (err: any) => {
        console.error(err);
        this.isloading = false;
      }
    });
  }
  goToInterviewPanel(candidate: any) {
    const org_id = candidate.org_id ?? candidate.applicants?.[0]?.org_id ?? this.orgid;
    const job_id = candidate.job_id ?? candidate.applicants?.[0]?.job_id ?? this.jobId;
    const applicantsid = candidate.applicantsid ?? candidate.applicants?.[0]?.applicantsid;
    const candidate_id = candidate.candidate_id;
    const status = candidate.status ?? candidate.applicants?.[0]?.status;
    const state = {
      candidate_id,
      org_id,
      job_id,
      applicantsid,
      status
    };
    this.router.navigate(['/ats/job/interview-panel'], { state });
    // this.secureNav.open('/ats/job/interview-panel', null, { state });
  }

  goToSubmissionPanel(candidate: any) {
    const org_id = candidate.org_id ?? candidate.applicants?.[0]?.org_id ?? this.orgid;
    const job_id = candidate.job_id ?? candidate.applicants?.[0]?.job_id ?? this.jobId;
    const applicantsid = candidate.applicantsid ?? candidate.applicants?.[0]?.applicantsid;
    const candidate_id = candidate.candidate_id;
    const status = candidate.status ?? candidate.applicants?.[0]?.status;
    const submissionid = candidate.SubmissionId ?? candidate.applicants?.[0]?.SubmissionId;
    const state = {
      candidate_id,
      org_id,
      job_id,
      applicantsid,
      status,
      submissionid
    };
    this.router.navigate(['/ats/job/submission'], { state });
    // this.secureNav.open('/ats/job/submission', null, { state });
  }

  goToPlacementPanel(candidate: any) {
    const org_id = candidate.org_id ?? candidate.applicants?.[0]?.org_id ?? this.orgid;
    const job_id = candidate.job_id ?? candidate.applicants?.[0]?.job_id ?? this.jobId;
    const applicantsid = candidate.applicantsid ?? candidate.applicants?.[0]?.applicantsid;
    const candidate_id = candidate.candidate_id;
    const status = candidate.status ?? candidate.applicants?.[0]?.status;
    const state = {
      candidate_id,
      org_id,
      job_id,
      applicantsid,
      status
    };
    this.router.navigate(['/ats/job/RecruitmentHub/PlacementDetails'], { state });
    // this.secureNav.open('/ats/job/RecruitmentHub/PlacementDetails', null, { state });
  }
  goToOnboardpanel(candidate: any) {
    const org_id = candidate.org_id ?? candidate.applicants?.[0]?.org_id ?? this.orgid;
    const job_id = candidate.job_id ?? candidate.applicants?.[0]?.job_id ?? this.jobId;
    const applicantsid = candidate.applicantsid ?? candidate.applicants?.[0]?.applicantsid;
    const candidate_id = candidate.candidate_id;
    const status = candidate.status ?? candidate.applicants?.[0]?.status;
    const state = {
      candidate_id,
      org_id,
      job_id,
      applicantsid,
      status
    };
    this.router.navigate(['/ats/job/RecruitmentHub/Onboardingdetails'], { state });
    // this.secureNav.open('/ats/job/RecruitmentHub/Onboardingdetails', null, { state });
  }

  moveTo(candidate: any, newStatus: string) {
    if (!this.canSeeStage(newStatus)) {
      this.toastr.warning('You do not have access to move to this stage.', 'Permission denied');
      return;
    }
    const currentContainer = this.getCurrentContainer(candidate);
    const targetContainer = this.findContainer(newStatus);
    const previousIndex = currentContainer.findIndex(c => c.candidate_id === candidate.candidate_id);
    if (previousIndex === -1) {
      return;
    }
    const eventMock = {
      previousContainer: { data: currentContainer },
      container: { data: targetContainer },
      previousIndex,
      currentIndex: 0
    };
    this.drop(eventMock as any, newStatus);
  }
  getCurrentContainer(candidate: any): any[] {
    const allContainers = [
      this.candidates,
      this.shortlisted,
      this.submitted,
      this.scheduledInterview,
      this.finalinterview,
      this.placed,
      this.onboarding,
      this.DocumentsCollecting,
    ];

    return allContainers.find(container =>
      container.some(c => c.candidate_id === candidate.candidate_id)
    ) || [];
  }
  findContainer(status: string): any[] {
    switch (status) {
      case 'Shortlisted': return this.shortlisted;
      case 'Submitted': return this.submitted;
      case 'ScheduledInterview': return this.scheduledInterview;
      case 'Final Interview': return this.finalinterview;
      case 'Placed': return this.placed;
      case 'Onboarding': return this.onboarding;
      case 'Droped': return this.droped;
      default: return this.candidates;
    }
  }
  getStatusNumber(status: string): number {
    switch (status) {
      case 'Shortlisted': return 2;
      case 'Submitted': return 3;
      case 'ScheduledInterview': return 4;
      case 'Placed': return 5;
      case 'Onboarding': return 6;
      case 'Droped': return 8;
      default: return 1;
    }
  }
  trackByCandidateId(index: number, candidate: any) {
    return candidate.candidate_id;
  }
  editCandidate(candidateId: number) {
    this.selectedCandidateId = candidateId;
    this.showStageModal = true;
  }
  closeStageModal() {
    this.showStageModal = false;
    this.selectedCandidateId = null;
    this.selectedStage = null;
  }
  shareCandidate(candidate: any) {

  }
  showDropReasonModal = false;
  dropReason: string = '';
  selectedCandidateToDrop: any = null;
  dropCandidate(candidate: any) {
    this.selectedCandidateToDrop = candidate;
    this.dropReason = '';
    this.showDropReasonModal = true;
  }
  closeDropReasonModal() {
    this.showDropReasonModal = false;
    this.selectedCandidateToDrop = null;
    this.dropReason = '';
  }
  confirmDrop() {
    if (!this.selectedCandidateToDrop || !this.dropReason) return;
    const req = {
      candidate_id: this.selectedCandidateToDrop.candidate_id,
      status: 8,
      details: this.selectedCandidateToDrop,
      reason: this.dropReason,
      timestamp: new Date().toISOString(),
      usermail: this.recruiterid,
      candidate_documentsid: this.selectedCandidateToDrop.candidate_documents || null

    };
    this.Service.updateCandidateStatustracker(req).subscribe({
      next: (res: any) => {
        this.snackBar.open(`${this.selectedCandidateToDrop.firstname} ${this.selectedCandidateToDrop.lastname} dropped.`, 'Close', { duration: 2000 });
        this.getassignedjobs();
        this.closeDropReasonModal();
      },
      error: () => {
        this.snackBar.open('Failed to drop candidate.', 'Close', { duration: 2000 });
        this.closeDropReasonModal();
      }
    });
  }

  openAICallLauncher() {
    const activeEl = document.activeElement as HTMLElement | null;
    activeEl?.blur();
    const dialogRef = this.dialog.open(AIcalllauncherComponent, {
      data: {
        jobId: this.jobId,
        candidateId: this.candidateId
      },
      disableClose: true,
    });
    dialogRef.afterClosed().subscribe(() => {
      activeEl?.focus();
    });
  }
  goBack() {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }
  }
  isScheduledInterview(stage?: string): boolean {
    if (!stage) return false;
    const s = stage.toLowerCase().replace(/[\s_-]+/g, '');
    return s === 'scheduledinterview';
  }

  isPlaced(stage?: string): boolean {
    if (!stage) return false;
    const s = stage.toLowerCase().replace(/[\s_-]+/g, '');
    return s === 'placed';
  }

  isonboard(stage?: string): boolean {
    if (!stage) return false;
    const s = stage.toLowerCase().replace(/[\s_-]+/g, '');
    return s === 'onboarding';
  }

  showReasonModal = false;
  reasonTitle = '';
  reasonText = '';

  reasonContext: {
    type: 'reverse' | 'drop';
    candidate: any;
    fromStage: string;
    toStage: string;
    targetStatusValue?: number;
    revertInfo?: {
      from: any[];
      to: any[];
      previousIndex: number;
      currentIndex: number;
    };
  } | null = null;


  openReasonModal(
    type: 'reverse' | 'drop',
    candidate: any,
    title: string,
    targetStatusValue?: number,
    fromStage?: string,
    toStage?: string,
    revertInfo?: { from: any[]; to: any[]; previousIndex: number; currentIndex: number }
  ) {
    this.reasonTitle = title;
    this.reasonText = '';
    this.reasonContext = {
      type,
      candidate,
      fromStage: fromStage || '',
      toStage: toStage || '',
      targetStatusValue,
      revertInfo
    };
    this.showReasonModal = true;
  }

  closeReasonModal() {
    if (this.reasonContext?.type === 'reverse' && this.reasonContext.revertInfo) {
      const { from, to, previousIndex, currentIndex } = this.reasonContext.revertInfo;
      transferArrayItem(to, from, currentIndex, previousIndex);
    }
    this.showReasonModal = false;
    this.reasonContext = null;
    this.reasonText = '';
  }

  confirmReason() {
    if (!this.reasonContext) return;

    const { type, candidate, targetStatusValue, fromStage, toStage, revertInfo } = this.reasonContext;
    const reason = this.reasonText.trim();
    if (!reason) {
      this.snackBar.open('Please provide a reason.', 'Close', { duration: 2000 });
      return;
    }

    if (type === 'reverse' && typeof targetStatusValue === 'number') {
      const req = {
        candidate_id: candidate.candidate_id,
        status: targetStatusValue,
        reason,
        details: candidate,
        timestamp: new Date().toISOString(),
        usermail: this.recruiterid,
        candidate_documentsid: candidate.candidate_documents
      };

      this.Service.updateCandidateStatustracker(req).subscribe({
        next: () => {
          this.snackBar.open(
            `Moved ${candidate.firstname} ${candidate.lastname} from ${fromStage} → ${toStage} with reason.`,
            'Close',
            { duration: 2000 }
          );
          this.getassignedjobs();
          this.resetReasonModal();
        },
        error: () => {
          this.snackBar.open('Failed to update status.', 'Close', { duration: 2000 });
          if (revertInfo) {
            const { from, to, previousIndex, currentIndex } = revertInfo;
            transferArrayItem(to, from, currentIndex, previousIndex);
          }
          this.resetReasonModal();
        }
      });
    }

    if (type === 'drop') {
      if (!this.canSeeStage('Droped')) {
        this.snackBar.open('You do not have access to move to this stage.', 'Close', { duration: 2000 });
        return;
      }

      const req = {
        candidate_id: candidate.candidate_id,
        status: 8,
        reason,
        details: candidate,
        timestamp: new Date().toISOString(),
        usermail: this.recruiterid,
        candidate_documentsid: candidate.candidate_documents || null
      };

      this.Service.updateCandidateStatustracker(req).subscribe({
        next: () => {
          this.snackBar.open(`${candidate.firstname} ${candidate.lastname} dropped.`, 'Close', { duration: 2000 });
          this.getassignedjobs();
          this.resetReasonModal();
        },
        error: () => {
          this.snackBar.open('Failed to drop candidate.', 'Close', { duration: 2000 });
          this.resetReasonModal();
        }
      });
    }
  }

  private resetReasonModal() {
    this.showReasonModal = false;
    this.reasonContext = null;
    this.reasonText = '';
  }

  getStageFromValue(value: number): string {
    switch (value) {
      case 1: return 'Assigned';
      case 2: return 'Shortlisted';
      case 3: return 'Submitted';
      case 4: return 'ScheduledInterview';
      case 5: return 'Placed';
      case 6: return 'Onboarding';
      case 8: return 'Droped';
      default: return 'Unknown';
    }
  }

  private async ensureCanMoveToOnboarding(candidate: any): Promise<boolean> {
    const placementId = candidate?.applicants?.[0]?.PlacementId;
    const orgId = candidate?.applicants?.[0]?.org_id;
    const jobId = candidate?.applicants?.[0]?.job_id;
    const candidateId = candidate?.candidate_id;
    const applicantsid =
      candidate?.applicantsid ??
      candidate?.ApplicantsId ??
      candidate?.applicants?.[0]?.applicantsid ??
      candidate?.applicants?.[0]?.ApplicantsId;

    if (!placementId) {
      this.toastr.warning('Cannot move to Onboarding: Placement is not created for this candidate.', 'Action blocked');
      return false;
    }
    if (!orgId || !jobId || !candidateId || !applicantsid) {
      this.toastr.error('Missing identifiers (orgId / jobId / candidateId / applicantsid). Cannot verify placement.', 'Error');
      return false;
    }


    try {
      const res: any = await this.Service
        .getPlacementDetails(placementId, orgId, jobId, candidateId, applicantsid)
        .toPromise();

      const data = res?.data ?? null;

      if (!res?.ok || !data) {
        this.toastr.warning('Cannot move to Onboarding: Placement details not found.', 'Action blocked');
        return false;
      }

      if (res?.is_complete !== true) {
        const missing = Array.isArray(res?.missing_fields) ? res.missing_fields.join(', ') : 'required fields';
        this.toastr.warning(
          `Cannot move to Onboarding: Missing ${missing}.`,
          'Action blocked'
        );
        return false;
      }
      return true;
    } catch (err) {
      console.error('Placement verification failed:', err);
      this.toastr.error('Unable to verify placement details. Please try again.', 'Error');
      return false;
    }
  }


  async drop(event: CdkDragDrop<any[]>, newStatus: string) {
    if (!this.canSeeStage(newStatus)) {
      this.toastr.warning('You do not have access to move to this stage.', 'Permission denied');
      return;
    }

    const movingFrom = event.previousContainer.data;
    const movingTo = event.container.data;
    const movedCandidate = movingFrom[event.previousIndex];

    const oldStatusValue =
      movedCandidate.status ??
      movedCandidate.applicants?.[0]?.status ??
      this.getStatusNumber(movedCandidate.currentStage ?? '') ??
      1;

    const fromStage = this.getStageFromValue(oldStatusValue);
    const toStage = newStatus;

    if (event.previousContainer === event.container) {
      moveItemInArray(movingTo, event.previousIndex, event.currentIndex);
      return;
    }

    const statusMap: { [key: string]: number } = {
      Assigned: 1,
      Shortlisted: 2,
      Submitted: 3,
      ScheduledInterview: 4,
      Placed: 5,
      Onboarding: 6,
      Droped: 8,
    };
    const statusValue = statusMap[newStatus] ?? 1;
    const isReverse = statusValue < oldStatusValue;

    // 🔒 gate for Onboarding
    if (!isReverse && newStatus === 'Onboarding') {
      const ok = await this.ensureCanMoveToOnboarding(movedCandidate);
      if (!ok) return;
    }

    transferArrayItem(movingFrom, movingTo, event.previousIndex, event.currentIndex);

    if (!isReverse && newStatus === 'Placed') {
      movedCandidate.status = statusValue;
      this.updateCandidateStatus(movedCandidate, statusValue);
      return;
    }

    if (isReverse) {
      const revertInfo = {
        from: movingFrom,
        to: movingTo,
        previousIndex: event.previousIndex,
        currentIndex: event.currentIndex
      };
      this.openReasonModal(
        'reverse',
        movedCandidate,
        `Reason for moving ${movedCandidate.firstname} ${movedCandidate.lastname} from ${fromStage} → ${toStage}`,
        statusValue,
        fromStage,
        toStage,
        revertInfo
      );
      return;
    }

    movedCandidate.status = statusValue;
    this.updateCandidateStatus(movedCandidate, statusValue);
  }

  async confirmStageUpdate() {
    if (!this.selectedCandidateId || !this.selectedStage) return;

    if (!this.canSeeStage(this.selectedStage)) {
      this.toastr.warning('You do not have access to move to this stage.', 'Permission denied');
      return;
    }


    const statusValue = this.getStatusValue(this.selectedStage);
    const candidate = this.allCandidates.find(c => c.candidate_id === this.selectedCandidateId);
    if (!candidate) return;

    const oldStatusValue = this.getStatusNumber(candidate.currentStage ?? '');

    if (this.selectedStage === 'Droped') {
      this.showStageModal = false;
      this.openReasonModal('drop', candidate, 'Reason for Dropping Candidate');
      return;
    }

    // 🔒 Extra gate: Onboarding requires existing Placement + details
    if (this.selectedStage === 'Onboarding') {
      const ok = await this.ensureCanMoveToOnboarding(candidate);
      if (!ok) return; // block update
    }

    if (this.selectedStage === 'Placed') {
      this.sendStageUpdate(candidate, statusValue);
      return;
    }

    if (this.selectedStage === 'ScheduledInterview') {
      if (statusValue < oldStatusValue) {
        this.showStageModal = false;
        this.openReasonModal('reverse', candidate, 'Reason for moving candidate backward', statusValue);
        return;
      }
      this.sendStageUpdate(candidate, statusValue);

      const candidateId = candidate.candidate_id;
      const orgId = candidate.applicants?.[0]?.org_id;
      const jobId = candidate.applicants?.[0]?.job_id;
      const applicantsId = candidate.applicants?.[0]?.applicantsid;
      if (candidateId && orgId && jobId && applicantsId) {
        this.router.navigate(['/ats/job/interview-panel'], { state: { candidate_id: candidateId, org_id: orgId, job_id: jobId, applicantsid: applicantsId, status: statusValue } });
      }
      return;
    }

    if (statusValue < oldStatusValue) {
      this.showStageModal = false;
      this.openReasonModal('reverse', candidate, 'Reason for moving candidate backward', statusValue);
      return;
    }
    this.sendStageUpdate(candidate, statusValue);
  }


  sendStageUpdate(candidate: any, statusValue: number) {
    const req = {
      candidate_id: candidate.candidate_id,
      status: statusValue,
      reason: this.reasonText || this.dropReason,
      details: candidate,
      timestamp: new Date().toISOString(),
      usermail: this.recruiterid,
      candidate_documentsid: candidate.candidate_documents || null

    };
    this.Service.updateCandidateStatustracker(req).subscribe({
      next: () => {
        this.snackBar.open('Candidate status updated', 'Close', { duration: 2000 });
        this.closeStageModal();
        this.getassignedjobs();
      },
      error: () => {
        this.snackBar.open('Failed to update status', 'Close', { duration: 2000 });
      }
    });
  }

  updateCandidateStatus(candidate: any, statusValue: number) {
    const req = {
      candidate_id: candidate.candidate_id,
      status: statusValue,
      details: candidate,
      reason: this.reasonText || '',
      timestamp: new Date().toISOString(),
      usermail: this.recruiterid,
      candidate_documentsid: candidate.candidate_documents
    };
    this.Service.updateCandidateStatustracker(req).subscribe({
      next: () => {
        this.snackBar.open('Candidate status updated', 'Close', { duration: 2000 });
        this.getassignedjobs();
      },
      error: () => {
        this.snackBar.open('Failed to update status', 'Close', { duration: 2000 });
      }
    });
  }


  open() {
    this.showModal = true;
    document.body.style.overflow = 'hidden';
  }


  close() {
    this.showModal = false;
    document.body.style.overflow = '';
    this.selectedGroupCandidates = [];
    this.selectAll = false;
    this.selectedGroup = '';

    this.showCandidateForm = true;
    this.showEmailForm = false;
    this.emailForm.reset();
    if (this.data.source == "Group") this.router.navigate(['/ats/group']);
    if (this.source == "CandidateMatching") this.router.navigate(['/ats/candidates/candidatematching']);

  }


  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') this.close();
  }



  getGroup(): void {
    if (this.orgid && this.divisionId && this.recruiterid && this.accesstype) {
      this.Service.groupDetail(this.orgid, this.divisionId, this.recruiterid, this.accesstype).subscribe({
        next: (res: any) => {
          this.groups = res?.data || [];

        },
        error: (err: any) => {
          console.error('Fetching error:', err);
        }
      });
    } else {
      console.warn('orgid or divisionId is missing');
    }
  }



  onGroupChange(event: MatSelectChange): void {
    const groupId = event.value;

    if (!groupId || groupId === '') {
      console.warn('No group selected');
      return;
    }

    this.getCandidatesByGroup(groupId);
  }

  // getCandidatesByGroup(groupId: string): void {
  //   const parsedId = Number(groupId);
  //   if (isNaN(parsedId)) {
  //     console.error('Invalid groupId:', groupId);
  //     return;
  //   }

  //   this.Service.getCandidatesByGroup(parsedId).subscribe({
  //     next: (res: any) => {
  //       this.selectedGroupCandidates = Array.isArray(res) ? res : res.data || [];
  //     },

  //     error: (err: any) => {
  //       console.error('Error fetching candidates:', err);
  //       this.selectedGroupCandidates = [];
  //     }
  //   });
  // }

  // --- helpers ---






  private parseGroupCandidateIds(raw: any): number[] {
    if (!raw) return [];

    let parsed: any;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      console.error('Failed to parse group CandidateIds:', raw, e);
      return [];
    }

    const result: number[] = [];
    const arr: any[] = Array.isArray(parsed) ? parsed : [];

    for (const item of arr) {
      if (Array.isArray(item)) {
        const cand = Number(item[0]); // [[candidateId, recruiterId], ...]
        if (!Number.isNaN(cand)) result.push(cand);
      } else if (typeof item === 'number') {
        result.push(item);
      }
    }

    return result;
  }
  private toNumber(n: any): number | undefined {
    const v = Number(n);
    return Number.isNaN(v) ? undefined : v;
  }


  private getMailedCandidateIdsForJob(
    rawRecruiterIds: any,
    groupCandidateIdsRaw: any,
    recruiterId?: number,
    jobId?: number
  ): Set<number> {
    const mailed = new Set<number>();

    if (!rawRecruiterIds || recruiterId == null || jobId == null) {
      return mailed;
    }

    // All candidates in this group (for fallback when candidateIds is missing)
    const groupCandIds = this.parseGroupCandidateIds(groupCandidateIdsRaw);

    let parsed: any;
    try {
      parsed = typeof rawRecruiterIds === 'string'
        ? JSON.parse(rawRecruiterIds)
        : rawRecruiterIds;
    } catch (e) {
      console.error('Failed to parse RecruiterIds:', rawRecruiterIds, e);
      return mailed;
    }

    const history = Array.isArray(parsed.history) ? parsed.history : [];

    for (const h of history) {
      const mailJobs: MailJob[] = Array.isArray(h?.mailJobs) ? h.mailJobs : [];

      for (const mj of mailJobs) {
        const mjRecruiter = this.toNumber((mj as any).recrutierid);
        const mjJobId = this.toNumber((mj as any).jobid);

        // Only consider mailJobs for this recruiter + this job
        if (mjRecruiter !== recruiterId || mjJobId !== jobId) continue;

        const mailCount = this.toNumber((mj as any).mail_count) ?? 0;

        let candsRaw = (mj as any).candidateIds;

        if (candsRaw) {
          // New format: explicit candidateIds list like "[2422,2423,2425]"
          let candParsed: any;
          try {
            candParsed = typeof candsRaw === 'string'
              ? JSON.parse(candsRaw)
              : candsRaw;
          } catch (e2) {
            console.error('Failed to parse mailJob.candidateIds:', candsRaw, e2);
            continue;
          }

          const candArr: any[] = Array.isArray(candParsed) ? candParsed : [];
          for (const cid of candArr) {
            const num = Number(cid);
            if (!Number.isNaN(num)) mailed.add(num);
          }
        } else if (mailCount > 0) {
          // Old format: no candidateIds, only mail_count -> assume ALL group candidates got mail
          for (const cid of groupCandIds) {
            mailed.add(cid);
          }
        }
      }
    }

    return mailed;
  }

  getCandidatesByGroup(groupId: string): void {
    this.isloading = true;
    const parsedId = Number(groupId);
    if (isNaN(parsedId)) {
      this.isloading = false;
      console.error('Invalid groupId:', groupId);
      return;
    }

    this.Service.getCandidatesByGroup(parsedId).subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        this.isloading = false;
        if (!list.length) {
          this.selectedGroupCandidates = [];
          return;
        }

        const firstRow = list[0];

        // recruiter from payload
        const recruiterId =
          this.toNumber(firstRow?.recruiter_userId) ??
          this.toNumber(firstRow?.recruiterid);

        // ✅ use the actual job id
        const currentJobId =
          this.toNumber(firstRow?.jobid) ??
          this.toNumber(firstRow?.job_id) ??
          this.toNumber(this.jobId); // fallback

        // raw JSON columns
        const recruiterIdsRaw = firstRow?.RecruiterIds;
        const groupCandidateRaw = firstRow?.CandidateIds;

        const mailedSet = this.getMailedCandidateIdsForJob(
          recruiterIdsRaw,
          groupCandidateRaw,
          recruiterId,
          currentJobId
        );



        this.selectedGroupCandidates = list.map((c: any) => {
          const cid =
            this.toNumber(c?.candidate_id) ??
            this.toNumber(c?.CandidateId) ??
            this.toNumber(c?.candidateId) ??
            this.toNumber(c?.id);

          const mailSent = cid != null && mailedSet.has(cid);

          return {
            ...c,
            _debugCandidateId: cid,
            mailSent
          };
        });




        // Extra: nice tabular debug
        console.table(
          this.selectedGroupCandidates.map((c: any) => ({
            raw_candidate_id: c.candidate_id,
            CandidateId: c.CandidateId,
            candidateId: c.candidateId,
            id: c.id,
            debugIdUsed: c._debugCandidateId,
            mailSent: c.mailSent
          }))
        );
      },

      error: (err: any) => {
        this.isloading = false;
        console.error('Error fetching candidates:', err);
        this.selectedGroupCandidates = [];
      }
    });
  }






  private initEmailForm() {
    this.emailForm = this.fb.group({
      to: this.fb.control<string[]>([], { validators: [Validators.required, this.emailsArrayValidator] }),
      cc: this.fb.control<string[]>([], { validators: [this.emailsArrayValidator] }),
      bcc: this.fb.control<string[]>([], { validators: [this.emailsArrayValidator] }),
      subject: ['', [Validators.required, Validators.maxLength(200)]],
      note: ['', [Validators.required]]
    });
  }


  emailsArrayValidator = (ctrl: AbstractControl) => {
    const arr = ctrl.value as string[];
    if (!arr || !arr.length) return null;
    const invalid = arr.some(e => !this.emailRegex.test(e));
    return invalid ? { emailsInvalid: true } : null;
  };

  addFromInput(field: 'to' | 'cc' | 'bcc', event: MatChipInputEvent) {
    const raw = (event.value || '').trim();
    if (!raw) return;
    const parts = raw.split(/[;,]+/).map(v => v.trim()).filter(Boolean);
    const control = this.emailForm.get(field)!;
    const current = (control.value as string[]) ?? [];
    control.setValue([...current, ...parts]);
    event.chipInput?.clear();
    control.updateValueAndValidity();
  }
  removeEmail(field: 'to' | 'cc' | 'bcc', index: number) {
    const control = this.emailForm.get(field)!;
    const current = (control.value as string[]) ?? [];
    current.splice(index, 1);
    control.setValue([...current]);
    control.updateValueAndValidity();
  }


  fetchCandidatesForGroup(groupId: number) {
    this.selectedGroupCandidates = [];
    this.selectAll = false;
  }




  toggleAll() {
    let count = 0;
    const maxSelect = 35;
    let warningShown = false;

    for (let c of this.selectedGroupCandidates) {
      if (count < maxSelect) {
        c.selected = this.selectAll;
        count++;
      } else {
        c.selected = false;
        if (!warningShown && this.selectAll) {
          this.toastr.warning(`Please select maximum ${maxSelect} candidates for sending mail.`);
          warningShown = true;
        }
      }
    }
  }

  onCandidateSelect(candidate: any) {
    this.selectAll = this.selectedGroupCandidates.every(c => c.selected);
  }

  hasSelectedCandidates(): boolean {
    return this.selectedGroupCandidates.some(c => c.selected);
  }


  private readonly MAX_RECIPIENTS = 45;

  goToEmailForm() {
    if (!this.hasSelectedCandidates()) {
      this.toastr.warning('Please select at least one candidate before sending mail.');
      return;
    }

    const selectedEmails = (this.selectedGroupCandidates ?? [])
      .filter(c => c?.selected && c?.email)
      .map(c => String(c.email).trim());

    const visibleTo =
      this.email && this.emailRegex?.test(this.email) ? this.email.trim() : '';

    let bccEmails = Array.from(
      new Set(
        selectedEmails.filter(e => !visibleTo || e.toLowerCase() !== visibleTo.toLowerCase())
      )
    );

    if (bccEmails.length > this.MAX_RECIPIENTS) {
      this.toastr.info(
        `You selected ${bccEmails.length} recipients. Only the first ${this.MAX_RECIPIENTS} will be included.`
      );
      bccEmails = bccEmails.slice(0, this.MAX_RECIPIENTS);
    }

    const jobTitle = String(
      this.jobDetails?.title ??
      this.jobDetails?.JobTitle ??
      this.jobDetails?.name ??
      ''
    ).trim();

    const jobDescription = String(
      this.jobDetails?.jobDescription ??
      this.jobDetails?.JobDescription ??
      ''
    ).trim();

    const extraNoteCore =
      `We are excited to connect with you regarding a new opportunity that aligns with your skills and career goals. ` +
      `Please review the details and let us know if you are interested.`;

    const detailsLines: string[] = [];
    if (jobTitle) detailsLines.push(`Title: ${jobTitle}`);
    if (jobDescription) detailsLines.push(`Job description: ${jobDescription}`);

    const extraNote = detailsLines.length
      ? `${extraNoteCore}\n\n${detailsLines.join('\n')}`
      : extraNoteCore;

    const first = (this.firstName ?? '').toString().trim();
    const last = (this.lastName ?? '').toString().trim();
    const signatureName: string = [first, last].filter(Boolean).join(' ') || 'Recruiter';
    const fromEmail: string = (this.email ?? '').toString().trim();

    const body = `Hey candidate,

${extraNote ? extraNote + '\n\n' : ''}Thank you,
${signatureName}
${fromEmail}`;

    const subject =
      this.emailForm.get('subject')?.value ||
      (jobTitle ? `Opportunity: ${jobTitle}` : 'Opportunity with our team');

    this.emailForm.patchValue({
      to: visibleTo ? [visibleTo] : [],
      bcc: bccEmails,
      subject,
      body,
      note: body
    });

    this.showCandidateForm = false;
    this.showEmailForm = true;
  }

  onSend() {
    this.jobId = this.jobId;
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }
    const form = this.emailForm.getRawValue();
    const subject = (form.subject || '').trim();
    const note = ((form as any).note ?? '').toString().trim();
    // const candidateId = (this.selectedGroupCandidates ?? [])
    //   .filter(c => c?.selected && c?.candidate_id)
    //   .map(c => String(c.candidate_id).trim());
    const candidateId = this.source === 'CandidateMatching'
      ? this.candidateIds.map(id => String(id))
      : (this.selectedGroupCandidates ?? [])
        .filter(c => c?.selected && c?.candidate_id)
        .map(c => String(c.candidate_id).trim());

    if (!subject || !note) {
      this.toastr.warning('Subject and message are required.');
      return;
    }
    if ((!form.to || form.to.length === 0) && this.email && this.emailRegex.test(this.email)) {
      this.emailForm.patchValue({ to: [this.email] });
    }
    const req = {
      to: (this.emailForm.getRawValue().to || []) as string[],
      cc: (form.cc || []) as string[],
      bcc: (form.bcc || []) as string[],
      subject,
      note,
      orgId: this.orgid,
      recruiterId: this.recruiterid || undefined,
      groupId: this.selectedGroup || undefined,
      jobId: this.jobId || undefined,
      candidateId
    };

    if (!req.to?.length) {
      this.toastr.warning('Your visible To address is missing.');
      return;
    }
    if (!req.bcc?.length) {
      this.toastr.warning('Please select at least one recipient (BCC).');
      return;
    }

    if (req.bcc.length > this.MAX_RECIPIENTS) {
      this.toastr.error(
        `You have ${req.bcc.length} BCC recipients. The limit is ${this.MAX_RECIPIENTS}. Please reduce the list and try again.`
      );
      return;
    }
    this.logs = [];
    this.progress = { sent: 0, failed: 0, total: req.bcc.length, percent: 0 };
    this.sending = true;

    const stream$ = this.GroupService.startEmailBroadcastSSE(req);
    if (this.sub) { this.sub.unsubscribe(); }

    this.sub = stream$.subscribe({
      next: (evt: BroadcastProgressEvent) => {

        switch (evt.kind) {
          case 'start': {
            if (typeof evt.total === 'number') this.progress.total = evt.total;
            this.progress.percent = evt.percent ?? 0;
            break;
          }

          case 'item': {
            if (evt.recipient && evt.status) {
              this.logs.unshift({
                status: evt.status,
                recipient: evt.recipient,
                message: evt.message || (evt.status === 'sent' ? 'Email delivered.' : 'Delivery failed.')
              });
            }
            if (typeof evt.sent === 'number') this.progress.sent = evt.sent;
            if (typeof evt.failed === 'number') this.progress.failed = evt.failed;

            const denom = this.progress.total || evt.total || req.bcc.length || 1;
            const done = this.progress.sent + this.progress.failed;
            this.progress.percent = evt.percent ?? Math.min(100, Math.round((done / denom) * 100));
            break;
          }
          case 'done': {
            if (typeof evt.sent === 'number') this.progress.sent = evt.sent;
            if (this.data.source == "Group") this.router.navigate(['/ats/group']);
            if (typeof evt.failed === 'number') this.progress.failed = evt.failed;
            this.progress.percent = 100;
            this.sending = false;

            const msg = this.progress.failed === 0
              ? `All ${this.progress.sent} emails sent successfully.`
              : `Sent ${this.progress.sent}, failed ${this.progress.failed}.`;
            this.toastr.success(msg);
            this.close();
            break;
          }

          case 'error': {
            this.sending = false;
            this.toastr.error(evt.message || 'Broadcast failed.');
            break;
          }
        }
      },
      error: () => {
        this.sending = false;
        this.toastr.error('Unexpected error during broadcast.');
      },
      complete: () => {
        this.sending = false;
      }

    });
  }

  async onSendSimpleFallback() {
    if (this.emailForm.invalid) { this.emailForm.markAllAsTouched(); return; }

    const { to, cc, bcc, subject, note } = this.emailForm.getRawValue();

    const recipients: string[] = (bcc || []).slice(0, this.MAX_RECIPIENTS);

    if (!to?.length) { this.toastr.warning('Your visible To address is missing.'); return; }
    if (!recipients.length) { this.toastr.warning('Please select at least one recipient (BCC).'); return; }
    if ((bcc || []).length > this.MAX_RECIPIENTS) {
      this.toastr.info(`You selected ${(bcc || []).length} recipients. Only the first ${this.MAX_RECIPIENTS} will be included.`);
    }

    this.logs = [];
    this.progress = { sent: 0, failed: 0, total: recipients.length, percent: 0 };
    this.sending = true;

    for (const recipient of recipients) {
      try {
        await this.GroupService
          .sendOneEmail({ to: recipient, subject, note, cc, bcc: [], orgId: this.orgid, groupId: this.selectedGroup })
          .toPromise();

        this.progress.sent += 1;
        this.logs.unshift({ status: 'sent', recipient, message: 'Email delivered.' });

      } catch (err: any) {
        this.progress.failed += 1;
        this.logs.unshift({ status: 'failed', recipient, message: err?.error?.message || 'Failed to send.' });
      }

      const done = this.progress.sent + this.progress.failed;
      this.progress.percent = Math.round((done / this.progress.total) * 200);
    }

    this.sending = false;
    this.toastr.success(`Sent ${this.progress.sent}, failed ${this.progress.failed}.`);
    this.close();
  }



  backToCandidateForm() {
    this.showCandidateForm = true;
    this.showEmailForm = false;
    this.source === 'CandidateMatching' && this.router.navigate(['/ats/candidates/candidatematching']);
  }
  onClear() {
    this.emailForm.reset({ to: [], cc: [], bcc: [], subject: '', note: '' });
  }



  cancelSend() {
    if (this.sub) {
      this.sub.unsubscribe();
      this.sub = null;
    }
    this.sending = false;
    this.toastr.info('Broadcast cancelled.');
  }

  // ==== NEW CODE: access helpers exposed to template/logic ====
  public canSeeStage = (stage: string): boolean => {
    const code = this.STAGE_ACCESS_CODE[stage];
    return !!code && this.trackerAccess.has(code);
  };

  /** Stages that are visible in filters (table) */
  get visibleStages(): string[] {
    return this.allStages.filter(s => this.canSeeStage(s));
  }
  // ===========================================================
  mailStatusFilter: 'all' | 'sent' | 'not' = 'all';

  // use this instead of iterating directly on selectedGroupCandidates
  get filteredGroupCandidates() {
    if (this.mailStatusFilter === 'sent') {
      return this.selectedGroupCandidates.filter(c => c.mailSent === true);
    }
    if (this.mailStatusFilter === 'not') {
      return this.selectedGroupCandidates.filter(c => !c.mailSent);
    }
    return this.selectedGroupCandidates;
  }

  checkRelevancyForKanbanList(list: any[]): void {
    list.forEach(candidate => {
      if (!candidate?.candidate_id) return;

      this.jobService
        .checkCandidateRelevancyResume(Number(this.jobId), candidate.candidate_id)
        .subscribe({
          next: (res) => {
            candidate.hasUpdatedResumeForJob = res.hasRelevancyResume;
            candidate.resumeFilename = res.resume_filename;
            candidate.resumeUploadedAt = res.uploaded_at;
          },
          error: () => {
            candidate.hasUpdatedResumeForJob = false;
          }
        });
    });
  }

}

interface MailJob {
  recrutierid: number;
  jobid: number;
  mail_count: number;
  candidateIds?: string | number[];
}
