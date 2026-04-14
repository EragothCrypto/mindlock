package com.mindlock

import android.app.Activity
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import kotlin.random.Random

/**
 * MindlockQuizActivity - Full-screen Quiz Overlay
 *
 * Requires the user to answer 3 questions correctly (2 easy + 1 hard).
 * Wrong answer → entire round restarts.
 *
 * After 2 failed rounds: Shows "ESCAPE OPTIONS"
 *   - 💸 LAZY UNLOCK: Opens Mindlock app to perform a $1.50 SKR payment to unlock
 *   - 🛡️ DAY PASS:   Opens Mindlock app to the Day Pass feature (24h shield, 500 SKR)
 */
class MindlockQuizActivity : Activity() {

    companion object {
        const val EXTRA_BLOCKED_PACKAGE = "blocked_package"

        // Intent extra to tell MainActivity what escape screen to navigate to
        const val EXTRA_ESCAPE_ACTION = "mindlock_escape_action"
        const val ESCAPE_LAZY_UNLOCK = "lazy_unlock"
        const val ESCAPE_DAY_PASS    = "day_pass"

        enum class Difficulty { EASY, HARD }

        data class QuizQuestion(
            val question: String,
            val options: List<String>,
            val correctIndex: Int,
            val difficulty: Difficulty = Difficulty.EASY
        )

        private val EASY_QUESTIONS = listOf(
            QuizQuestion("What is the native token of Solana?",
                listOf("ETH", "SOL", "BTC", "AVAX"), 1),
            QuizQuestion("What is the name of Solana's mobile phone?",
                listOf("Galaxy", "Saga", "Seeker", "Solana Phone"), 2),
            QuizQuestion("What wallet is most popular in the Solana ecosystem?",
                listOf("MetaMask", "Trust Wallet", "Phantom", "Coinbase Wallet"), 2),
            QuizQuestion("Who is the co-founder of Solana?",
                listOf("Vitalik Buterin", "Anatoly Yakovenko", "Satoshi Nakamoto", "Charles Hoskinson"), 1),
            QuizQuestion("What is the name of Solana's popular NFT marketplace?",
                listOf("OpenSea", "Magic Eden", "Rarible", "Foundation"), 1),
            QuizQuestion("What is Solana's theoretical TPS capacity?",
                listOf("100 TPS", "1,000 TPS", "65,000 TPS", "1 million TPS"), 2),
        )

        private val HARD_QUESTIONS = listOf(
            QuizQuestion("What consensus mechanism does Solana use alongside PoS?",
                listOf("Proof of Work", "Proof of History", "Proof of Authority", "Proof of Burn"), 1,
                Difficulty.HARD),
            QuizQuestion("What programming language are Solana programs typically written in?",
                listOf("JavaScript", "Python", "Rust", "Go"), 2, Difficulty.HARD),
            QuizQuestion("What is the Solana Program Library commonly called?",
                listOf("SPL", "SOL-LIB", "SOLPROG", "SLIB"), 0, Difficulty.HARD),
            QuizQuestion("What framework is commonly used to build Solana programs?",
                listOf("Hardhat", "Truffle", "Anchor", "Brownie"), 2, Difficulty.HARD),
            QuizQuestion("What is \$SKR token used for in the Seeker ecosystem?",
                listOf("Gas fees", "Guardian staking", "NFT minting", "Bridge fees"), 1, Difficulty.HARD),
            QuizQuestion("What is a 'Guardian' in the Seeker staking meta?",
                listOf("A validator node", "A delegated staking position", "A wallet type", "An NFT collection"),
                1, Difficulty.HARD),
            QuizQuestion("What does 'PoH' stand for in Solana?",
                listOf("Proof of Humanity", "Proof of History", "Proof of Hash", "Point of Honor"), 1,
                Difficulty.HARD),
        )

        fun buildQuizRound(): List<QuizQuestion> {
            val easy = EASY_QUESTIONS.shuffled().take(2)
            val hard = HARD_QUESTIONS.shuffled().take(1)
            return (easy + hard).shuffled()
        }
    }

    private lateinit var prefs: WardenPreferences

    // State
    private val questionQueue = mutableListOf<QuizQuestion>()
    private var currentQuestionIndex = 0
    private var correctCount = 0
    private var selectedAnswer: Int = -1
    private var failedRounds = 0               // rounds failed (wrong answer mid-round)
    private val ESCAPE_THRESHOLD = 2           // show escape after this many failures

    // UI elements
    private lateinit var scrollView: ScrollView
    private lateinit var progressText: TextView
    private lateinit var failBadge: TextView
    private lateinit var questionText: TextView
    private lateinit var radioGroup: RadioGroup
    private lateinit var submitButton: Button
    private lateinit var escapePanel: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = WardenPreferences(this)
        setupFullScreen()
        createUI()
        startNewRound()
    }

    private fun startNewRound() {
        questionQueue.clear()
        questionQueue.addAll(buildQuizRound())
        currentQuestionIndex = 0
        correctCount = 0
        loadQuestion(currentQuestionIndex)
    }

    private fun setupFullScreen() {
        window.setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.addFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL)
    }

    private fun createUI() {
        // ── Background: warmer near-black (#020408)
        scrollView = ScrollView(this).apply {
            setBackgroundColor(Color.parseColor("#020408"))
        }

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 80, 48, 80)
        }

        // ── Header: neon green with glow shadow
        layout.addView(TextView(this).apply {
            text = "🔒 MINDLOCK"
            setTextColor(Color.parseColor("#00FF41"))
            textSize = 26f
            typeface = android.graphics.Typeface.MONOSPACE
            letterSpacing = 0.18f
            setShadowLayer(14f, 0f, 0f, Color.parseColor("#4400FF41"))
            setPadding(0, 0, 0, 4)
        })

        // ── Fail badge
        failBadge = TextView(this).apply {
            text = ""
            setTextColor(Color.parseColor("#FF0040"))
            textSize = 11f
            typeface = android.graphics.Typeface.MONOSPACE
            setPadding(0, 0, 0, 8)
        }
        layout.addView(failBadge)

        // ── Progress: cyan tint with increased letter spacing
        progressText = TextView(this).apply {
            setTextColor(Color.parseColor("#00FFFF"))
            textSize = 12f
            typeface = android.graphics.Typeface.MONOSPACE
            letterSpacing = 0.15f
            setPadding(0, 0, 0, 28)
        }
        layout.addView(progressText)

        // ── Question card: dark surface with 3dp neon border
        val questionCard = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                setColor(Color.parseColor("#0D1117"))
                setStroke(3, Color.parseColor("#00FF41"))
                cornerRadius = 10f
            }
            setPadding(36, 28, 36, 28)
            val lp = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            lp.setMargins(0, 0, 0, 24)
            layoutParams = lp
        }
        questionText = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 17f
            typeface = android.graphics.Typeface.MONOSPACE
            setLineSpacing(6f, 1f)
        }
        questionCard.addView(questionText)
        layout.addView(questionCard)

        // ── Radio group
        radioGroup = RadioGroup(this).apply { setPadding(0, 0, 0, 28) }
        layout.addView(radioGroup)

        // ── Submit button: green→cyan gradient
        submitButton = Button(this).apply {
            text = "SUBMIT ANSWER"
            background = GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                intArrayOf(Color.parseColor("#00FF41"), Color.parseColor("#00FFFF"))
            ).apply { cornerRadius = 10f }
            setTextColor(Color.parseColor("#020408"))
            textSize = 15f
            typeface = android.graphics.Typeface.create(
                android.graphics.Typeface.MONOSPACE, android.graphics.Typeface.BOLD)
            letterSpacing = 0.1f
            isEnabled = false
            alpha = 0.45f
            setOnClickListener { checkAnswer() }
        }
        layout.addView(submitButton)

        // ── Grace info
        layout.addView(TextView(this).apply {
            text = if (prefs.isGuardianDelegator)
                "✓ GUARDIAN: ${prefs.gracePeriodMinutes}min grace"
            else
                "STANDARD: ${prefs.gracePeriodMinutes}min grace"
            setTextColor(if (prefs.isGuardianDelegator) Color.parseColor("#00FFFF") else Color.parseColor("#444455"))
            textSize = 11f
            typeface = android.graphics.Typeface.MONOSPACE
            setPadding(0, 28, 0, 4)
        })

        // ── Blocked app tag
        val pkg = intent.getStringExtra(EXTRA_BLOCKED_PACKAGE) ?: "Unknown"
        layout.addView(TextView(this).apply {
            text = "> BLOCKED: ${pkg.split(".").lastOrNull() ?: pkg}"
            setTextColor(Color.parseColor("#FF0040"))
            textSize = 10f
            typeface = android.graphics.Typeface.MONOSPACE
            letterSpacing = 0.12f
        })

        // ── ESCAPE PANEL: dark amber-tinted surface with amber border
        escapePanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                setColor(Color.parseColor("#1A0D00"))
                setStroke(3, Color.parseColor("#FF8800"))
                cornerRadius = 10f
            }
            val lp = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            lp.setMargins(0, 40, 0, 0)
            layoutParams = lp
            setPadding(36, 32, 36, 32)
        }

        escapePanel.addView(TextView(this).apply {
            text = "─────── ESCAPE OPTIONS ───────"
            setTextColor(Color.parseColor("#FF8800"))
            textSize = 11f
            typeface = android.graphics.Typeface.MONOSPACE
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 16)
        })

        escapePanel.addView(TextView(this).apply {
            text = "You've failed ${ESCAPE_THRESHOLD}×. Skip the quiz or pause the Warden:"
            setTextColor(Color.parseColor("#AAAAAA"))
            textSize = 12f
            typeface = android.graphics.Typeface.MONOSPACE
            setPadding(0, 0, 0, 20)
        })

        // ── Lazy Unlock: amber gradient button
        val lazyLp = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        )
        lazyLp.setMargins(0, 0, 0, 16)
        escapePanel.addView(Button(this).apply {
            text = "💸  LAZY UNLOCK  –  Pay $1.50 SKR"
            background = GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                intArrayOf(Color.parseColor("#CC6600"), Color.parseColor("#FF8800"))
            ).apply { cornerRadius = 10f }
            setTextColor(Color.parseColor("#020408"))
            textSize = 14f
            typeface = android.graphics.Typeface.MONOSPACE
            layoutParams = lazyLp
            setPadding(0, 28, 0, 28)
            setOnClickListener { openEscapeInApp(ESCAPE_LAZY_UNLOCK) }
        })

        // ── Day Pass: cyan gradient button
        escapePanel.addView(Button(this).apply {
            text = "🛡️  DAY PASS  –  24h Shield  (500 SKR)"
            background = GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                intArrayOf(Color.parseColor("#006688"), Color.parseColor("#00FFFF"))
            ).apply { cornerRadius = 10f }
            setTextColor(Color.parseColor("#020408"))
            textSize = 14f
            typeface = android.graphics.Typeface.MONOSPACE
            setPadding(0, 28, 0, 28)
            setOnClickListener { openEscapeInApp(ESCAPE_DAY_PASS) }
        })

        layout.addView(escapePanel)

        scrollView.addView(layout)
        setContentView(scrollView)
    }

    private fun loadQuestion(index: Int) {
        val q = questionQueue[index]
        val tag = if (q.difficulty == Difficulty.HARD) "⚡ HARD  " else "        "
        progressText.text = "${tag}QUESTION ${index + 1} / ${questionQueue.size}  •  $correctCount ✓"
        questionText.text = q.question

        radioGroup.removeAllViews()
        selectedAnswer = -1
        submitButton.isEnabled = false
        submitButton.alpha = 0.45f

        q.options.forEachIndexed { i, opt ->
            radioGroup.addView(RadioButton(this).apply {
                id = View.generateViewId()
                text = opt
                setTextColor(Color.WHITE)
                buttonTintList = android.content.res.ColorStateList.valueOf(Color.parseColor("#00FF41"))
                textSize = 15f
                typeface = android.graphics.Typeface.MONOSPACE
                setPadding(16, 20, 16, 20)
                setOnClickListener {
                    selectedAnswer = i
                    submitButton.isEnabled = true
                    submitButton.alpha = 1.0f
                }
            })
        }
    }

    private fun checkAnswer() {
        val q = questionQueue[currentQuestionIndex]

        if (selectedAnswer == q.correctIndex) {
            correctCount++
            val remaining = questionQueue.size - currentQuestionIndex - 1
            if (remaining > 0) {
                Toast.makeText(this, "✓ CORRECT! $remaining more...", Toast.LENGTH_SHORT).show()
                currentQuestionIndex++
                loadQuestion(currentQuestionIndex)
            } else {
                // All 3 correct — grant access
                prefs.recordUnlock()
                prefs.incrementQuizCount()
                Toast.makeText(this,
                    "✓ ALL CORRECT! Access granted for ${prefs.gracePeriodMinutes} minutes",
                    Toast.LENGTH_SHORT).show()
                finish()
            }
        } else {
            // Wrong — restart round, count failure
            failedRounds++
            Toast.makeText(this,
                "✗ WRONG! Round restarted. (Failure #$failedRounds)",
                Toast.LENGTH_LONG).show()
            updateFailBadge()

            if (failedRounds >= ESCAPE_THRESHOLD) {
                escapePanel.visibility = View.VISIBLE
                scrollView.post { scrollView.fullScroll(View.FOCUS_DOWN) }
            }

            startNewRound()
        }
    }

    private fun updateFailBadge() {
        failBadge.text = "✗ FAILED $failedRounds / $ESCAPE_THRESHOLD — ${
            if (failedRounds >= ESCAPE_THRESHOLD) "ESCAPE AVAILABLE ↓" else "${ESCAPE_THRESHOLD - failedRounds} more until escape"
        }"
    }

    /**
     * Launch the Mindlock main app with an escape action intent.
     * App.tsx picks up 'mindlock_escape_action' from the intent and navigates accordingly.
     */
    private fun openEscapeInApp(action: String) {
        val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            putExtra(EXTRA_ESCAPE_ACTION, action)
            addFlags(android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP)
            addFlags(android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        if (intent != null) {
            startActivity(intent)
            finish()
        } else {
            Toast.makeText(this, "Open Mindlock app to access escape options", Toast.LENGTH_LONG).show()
        }
    }

    override fun onBackPressed() {
        Toast.makeText(this, "Answer all 3 questions to unlock", Toast.LENGTH_SHORT).show()
    }
}
