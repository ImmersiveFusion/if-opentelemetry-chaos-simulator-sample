import { trigger, state, style, animate, transition } from '@angular/animations';

// Using CSS animations for complex keyframe effects in SCSS
// Angular animations for simple state transitions only
export const networkDiagramAnimations = [
  // Node state animation
  trigger('nodeState', [
    state('idle', style({
      transform: 'scale(1)',
      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
    })),
    state('processing', style({
      transform: 'scale(1.02)',
      filter: 'drop-shadow(0 4px 8px rgba(33, 150, 243, 0.3))'
    })),
    state('success', style({
      filter: 'drop-shadow(0 0 15px rgba(76, 175, 80, 0.6))'
    })),
    state('error', style({
      filter: 'drop-shadow(0 0 15px rgba(244, 67, 54, 0.6))'
    })),
    transition('* => processing', animate('200ms ease-out')),
    transition('processing => success', animate('300ms ease-out')),
    transition('processing => error', animate('200ms ease-out')),
    transition('success => idle', animate('500ms ease-out')),
    transition('error => idle', animate('500ms ease-out'))
  ]),

  // Request dot enter/leave
  trigger('requestDot', [
    transition(':enter', [
      style({ transform: 'scale(0)', opacity: 0 }),
      animate('200ms ease-out', style({ transform: 'scale(1)', opacity: 1 }))
    ]),
    transition(':leave', [
      animate('200ms ease-in', style({ transform: 'scale(0)', opacity: 0 }))
    ])
  ]),

  // Break icon animation
  trigger('breakIcon', [
    transition(':enter', [
      style({ transform: 'scale(0) rotate(-45deg)', opacity: 0 }),
      animate('300ms ease-out', style({ transform: 'scale(1) rotate(0deg)', opacity: 1 }))
    ]),
    transition(':leave', [
      animate('200ms ease-in', style({ transform: 'scale(0)', opacity: 0 }))
    ])
  ])
];
