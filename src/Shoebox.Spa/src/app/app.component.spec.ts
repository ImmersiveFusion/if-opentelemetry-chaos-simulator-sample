import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

/**
 * A smoke test for the jsdom lane, not for AppComponent.
 *
 * The vitest config runs two projects: this one in jsdom for ordinary component
 * specs, and a browser project in real Chromium for anything that renders Mermaid.
 * Without at least one spec here, the jsdom lane and the whole AnalogJS TestBed
 * setup would sit unexercised, and the first person to write a component test
 * would be the one to discover it never worked. Compiling and creating a real
 * component is the cheapest way to keep that honest.
 */
describe('jsdom test lane', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      schemas: [],
    })
      .overrideComponent(AppComponent, { set: { template: '<span>{{ title }}</span>' } })
      .compileComponents();
  });

  it('compiles and creates a component through TestBed', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.title).toBe('Shoebox');
    expect(fixture.nativeElement.textContent).toContain('Shoebox');
  });
});
