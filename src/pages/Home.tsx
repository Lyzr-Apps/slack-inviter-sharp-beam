import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { callAIAgent } from '@/utils/aiAgent'
import type { NormalizedAgentResponse } from '@/utils/aiAgent'
import { Mail, Send, X, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

// TypeScript interfaces from actual_test_response in channel_invite_agent_response.json
interface InviteSent {
  email: string
  user_id: string
  user_name: string
  message_sent: boolean
  timestamp: string
}

interface InviteFailed {
  email: string
  reason: string
  error_details: string
}

interface InviteSummary {
  total_emails: number
  successful: number
  failed: number
}

interface AgentResult {
  invites_sent: InviteSent[]
  invites_failed: InviteFailed[]
  summary: InviteSummary
}

// Agent ID from workflow.json
const AGENT_ID = "696e7c1de1e4c42b224b2a06"

// Email validation helper
function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email.trim())
}

// Parse emails from textarea (comma or newline separated)
function parseEmails(input: string): string[] {
  const emails = input
    .split(/[,\n]/)
    .map(e => e.trim())
    .filter(e => e.length > 0)

  return [...new Set(emails)] // Remove duplicates
}

// Email chip component
function EmailChip({ email, onRemove }: { email: string; onRemove: () => void }) {
  const isValid = isValidEmail(email)

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
      isValid
        ? 'bg-[#4A154B] text-white'
        : 'bg-red-100 text-red-700 border border-red-300'
    }`}>
      <Mail className="h-3.5 w-3.5" />
      <span>{email}</span>
      <button
        onClick={onRemove}
        className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
        aria-label={`Remove ${email}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// Result item component
function ResultItem({ invite }: { invite: InviteSent | InviteFailed }) {
  const [isOpen, setIsOpen] = useState(false)
  const isSent = 'user_id' in invite

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {isSent ? (
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 break-all">{invite.email}</span>
                {isSent ? (
                  <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
                    Sent
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    {(invite as InviteFailed).reason === 'user_not_found' ? 'Not Found' : 'Failed'}
                  </Badge>
                )}
              </div>
              {isSent && (
                <p className="text-sm text-gray-600 mt-1">
                  {(invite as InviteSent).user_name}
                </p>
              )}
              {!isSent && (
                <p className="text-sm text-red-600 mt-1">
                  {(invite as InviteFailed).error_details}
                </p>
              )}
            </div>
          </div>
          {isSent && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="flex-shrink-0">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          )}
        </div>
        {isSent && (
          <CollapsibleContent>
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-gray-500 mb-2">Message details:</p>
              <div className="bg-gray-100 rounded p-3 text-sm">
                <p className="text-gray-700">
                  User ID: <code className="bg-white px-1.5 py-0.5 rounded text-xs">{(invite as InviteSent).user_id}</code>
                </p>
                <p className="text-gray-700 mt-1">
                  Timestamp: {new Date((invite as InviteSent).timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  )
}

export default function Home() {
  const [emailInput, setEmailInput] = useState('alice@company.com, bob@company.com, charlie@example.com')
  const [context, setContext] = useState('Great chatting at the hackathon!')
  const [includeDescription, setIncludeDescription] = useState(true)
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<NormalizedAgentResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const emails = parseEmails(emailInput)
  const validEmails = emails.filter(isValidEmail)
  const invalidEmails = emails.filter(e => !isValidEmail(e))

  const handleRemoveEmail = (emailToRemove: string) => {
    const updatedEmails = emails.filter(e => e !== emailToRemove)
    setEmailInput(updatedEmails.join(', '))
  }

  const handleSendInvites = async () => {
    if (validEmails.length === 0) {
      setError('Please enter at least one valid email address')
      return
    }

    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      // Build a clear, natural language message with structured data for the agent
      const message = `Please send Slack channel invites to #made-with-architect for the following emails:

Emails to invite: ${validEmails.join(', ')}

Personalization context: "${context || "I'd like to invite you to join our community"}"

${includeDescription ? 'Include a description of the #made-with-architect channel in the invite message.' : 'Do not include the channel description.'}

For each email:
1. Look up the Slack user using their email address
2. Generate a personalized invite message with a greeting, the personalization context, and invitation to join #made-with-architect
3. Send the DM to the user
4. Return results showing which invites were sent successfully and which failed (with reasons)`

      const result = await callAIAgent(message, AGENT_ID)

      if (result.success) {
        // Always set the response, even if agent status is "error"
        setResponse(result.response)

        // If agent returned an error status, also show error message
        if (result.response.status === 'error') {
          const agentResult = result.response.result as AgentResult
          if (agentResult?.invites_failed?.length > 0) {
            const errors = agentResult.invites_failed.map(f => f.error_details).join('\n')
            setError(errors)
          }
        }
      } else {
        // API-level error
        const errorDetails = result.details || result.raw_response || result.error || 'Failed to send invites'
        setError(errorDetails)
        console.error('Agent error:', result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      console.error('Exception:', err)
    } finally {
      setLoading(false)
    }
  }

  const agentResult = response?.result as AgentResult | undefined

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-[#4A154B] text-white py-6 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Slack Channel Inviter</h1>
            <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30">
              #made-with-architect
            </Badge>
          </div>
          <p className="text-purple-100 mt-2">
            Send personalized invites to your Slack channel
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Email Input Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-[#4A154B]" />
              Email Recipients
            </CardTitle>
            <CardDescription>
              Enter email addresses separated by commas or new lines
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email-input">Email Addresses</Label>
              <Textarea
                id="email-input"
                placeholder="Enter emails, one per line or comma-separated&#10;e.g., alice@company.com, bob@company.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                rows={4}
                className="mt-1.5 font-mono text-sm"
              />
            </div>

            {/* Email Chips Display */}
            {emails.length > 0 && (
              <div className="space-y-3">
                {validEmails.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Valid Emails ({validEmails.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {validEmails.map((email) => (
                        <EmailChip
                          key={email}
                          email={email}
                          onRemove={() => handleRemoveEmail(email)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {invalidEmails.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4" />
                      Invalid Emails ({invalidEmails.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {invalidEmails.map((email) => (
                        <EmailChip
                          key={email}
                          email={email}
                          onRemove={() => handleRemoveEmail(email)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Personalization Card */}
        <Card>
          <CardHeader>
            <CardTitle>Personalization</CardTitle>
            <CardDescription>
              Add context to make your invite more personal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="context">Why are you inviting them?</Label>
              <Input
                id="context"
                placeholder="e.g., 'Loved your demo at the meetup'"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="include-desc">Include channel description</Label>
                <p className="text-sm text-gray-500">
                  Add context about the #made-with-architect channel
                </p>
              </div>
              <Switch
                id="include-desc"
                checked={includeDescription}
                onCheckedChange={setIncludeDescription}
              />
            </div>
          </CardContent>
        </Card>

        {/* Preview Card */}
        {validEmails.length > 0 && (
          <Card className="border-[#4A154B]/20">
            <CardHeader>
              <CardTitle className="text-[#4A154B]">Preview</CardTitle>
              <CardDescription>
                Sample message that will be sent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-700 leading-relaxed">
                  <span className="font-semibold">Hi there!</span>
                  <br />
                  <br />
                  {context && (
                    <>
                      {context}
                      <br />
                      <br />
                    </>
                  )}
                  I'd like to invite you to join the <span className="font-semibold text-[#4A154B]">#made-with-architect</span> channel.
                  {includeDescription && (
                    <>
                      {' '}This is our space to share projects, ideas, and collaborate on amazing builds.
                    </>
                  )}
                  <br />
                  <br />
                  Looking forward to seeing you there!
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Send Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleSendInvites}
            disabled={loading || validEmails.length === 0}
            size="lg"
            className="bg-[#4A154B] hover:bg-[#611f69] text-white px-8"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" />
                Send Invites
                {validEmails.length > 0 && (
                  <Badge variant="secondary" className="ml-2 bg-white text-[#4A154B]">
                    {validEmails.length}
                  </Badge>
                )}
              </>
            )}
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-red-900">Error</p>
                  <ScrollArea className="max-h-[200px] mt-2">
                    <pre className="text-sm text-red-700 whitespace-pre-wrap break-words font-mono bg-red-100 p-3 rounded">
                      {error}
                    </pre>
                  </ScrollArea>
                  {error.includes('missing_scope') && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-sm text-yellow-800">
                        <strong>Slack Permission Issue:</strong> The Slack integration needs additional permissions.
                        The agent needs to reconnect to Slack with the following scopes: users:read, users:read.email, chat:write
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {response && agentResult && agentResult.summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {response.status === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                )}
                Invite Results
              </CardTitle>
              <CardDescription>
                {response.status === 'success'
                  ? 'Summary of sent invitations'
                  : 'Some invites encountered issues'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {agentResult.summary?.total_emails || 0}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Total</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
                  <p className="text-2xl font-bold text-green-700">
                    {agentResult.summary?.successful || 0}
                  </p>
                  <p className="text-sm text-green-600 mt-1">Sent</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center border border-red-200">
                  <p className="text-2xl font-bold text-red-700">
                    {agentResult.summary?.failed || 0}
                  </p>
                  <p className="text-sm text-red-600 mt-1">Failed</p>
                </div>
              </div>

              <Separator />

              {/* Detailed Results */}
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {/* Successful Invites */}
                  {agentResult.invites_sent && agentResult.invites_sent.length > 0 && (
                    <>
                      <h3 className="font-semibold text-green-700 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Successfully Sent ({agentResult.invites_sent.length})
                      </h3>
                      {agentResult.invites_sent.map((invite, idx) => (
                        <ResultItem key={`sent-${idx}`} invite={invite} />
                      ))}
                    </>
                  )}

                  {/* Failed Invites */}
                  {agentResult.invites_failed && agentResult.invites_failed.length > 0 && (
                    <>
                      {agentResult.invites_sent && agentResult.invites_sent.length > 0 && <Separator className="my-4" />}
                      <h3 className="font-semibold text-red-700 flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Failed ({agentResult.invites_failed.length})
                      </h3>
                      {agentResult.invites_failed.map((invite, idx) => (
                        <ResultItem key={`failed-${idx}`} invite={invite} />
                      ))}
                    </>
                  )}

                  {/* No Results Message */}
                  {(!agentResult.invites_sent || agentResult.invites_sent.length === 0) &&
                   (!agentResult.invites_failed || agentResult.invites_failed.length === 0) && (
                    <div className="text-center py-8 text-gray-500">
                      <p>No invite results to display</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Error Response */}
        {response && response.status === 'error' && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">Agent Error</p>
                  <p className="text-sm text-red-700 mt-1">
                    {response.message || 'The agent encountered an error processing your request'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-6 text-center text-gray-500 text-sm">
        <p>Powered by Lyzr Agent API</p>
      </footer>
    </div>
  )
}
